import ethers from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC = 'https://sepolia-rpc.giwa.io';
const PK = process.env.DEPLOYER_PRIVATE_KEY;
const ADDR = "0xaf8EB7a4e7d489B742E65b4B3C31ec53125770c4";

const artifact = JSON.parse(await import('fs').then(fs => fs.readFileSync('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json', 'utf8')));
const provider = new ethers.providers.JsonRpcProvider(RPC);
const manager = new ethers.Wallet(PK, provider);
const managerContract = new ethers.Contract(ADDR, artifact.abi, manager);

// 生成测试钱包
const w1 = ethers.Wallet.createRandom().connect(provider);
const w2 = ethers.Wallet.createRandom().connect(provider);
const w3 = ethers.Wallet.createRandom().connect(provider);

// 给测试钱包转账 ETH
async function fundWallet(w, eth) {
  const tx = await manager.sendTransaction({ to: w.address, value: ethers.utils.parseEther(eth) });
  await tx.wait();
  console.log('  Funded', w.address.slice(0,10), 'with', eth, 'ETH');
}

async function wait(s) {
  console.log(`  等待 ${s} 秒...`);
  await new Promise(r => setTimeout(r, s * 1000));
}

async function main() {
  console.log('=== GiwaLotteryV4 完整测试 ===\n');

  // 1. 用管理器配置：0.001 ETH, 最多10人, 60秒 duration
  console.log('1. 配置合约 (60秒开奖)...');
  const cfgTx = await managerContract.configure(
    ethers.utils.parseEther('0.001'), 10, 60, { gasLimit: 200000 }
  );
  await cfgTx.wait();
  console.log('  配置完成\n');

  // 2. 给测试钱包转账
  console.log('2. 准备测试钱包...');
  await fundWallet(w1, '0.01');
  await fundWallet(w2, '0.01');
  await fundWallet(w3, '0.01');
  console.log('');

  const c1 = new ethers.Contract(ADDR, artifact.abi, w1);
  const c2 = new ethers.Contract(ADDR, artifact.abi, w2);
  const c3 = new ethers.Contract(ADDR, artifact.abi, w3);

  // 3. 购票
  console.log('3. 购票测试...');
  const price = await managerContract.ticketPrice();
  console.log('  票价:', ethers.utils.formatEther(price), 'ETH');

  let tx, receipt;
  tx = await c1.buyTickets(3, { value: price.mul(3) });
  receipt = await tx.wait();
  console.log('  w1 购买3张:', receipt.status === 1 ? '成功' : '失败');

  tx = await c2.buyTickets(2, { value: price.mul(2) });
  receipt = await tx.wait();
  console.log('  w2 购买2张:', receipt.status === 1 ? '成功' : '失败');

  tx = await c3.buyTickets(1, { value: price });
  receipt = await tx.wait();
  console.log('  w3 购买1张:', receipt.status === 1 ? '成功' : '失败');

  const tickets = await managerContract.getTotalTickets();
  const pool = await managerContract.getPrizePool();
  const phase = await managerContract.currentPhase();
  console.log(`  当前: ${tickets} 张票, 奖池 ${ethers.utils.formatEther(pool)} ETH, 阶段 ${phase}\n`);

  // 4. 等待定时到期
  console.log('4. 等待定时到期...');
  const endTime = await managerContract.endTime();
  const now = Math.floor(Date.now() / 1000);
  const waitSec = Math.max(0, endTime.toNumber() - now) + 2;
  console.log(`  需要等待 ${waitSec} 秒`);
  await wait(waitSec);

  // 5. checkTimerExpiry
  console.log('\n5. 调用 checkTimerExpiry...');
  const phase0 = await managerContract.currentPhase();
  console.log('  调用前阶段:', phase0.toString());
  try {
    tx = await managerContract.checkTimerExpiry({ gasLimit: 200000 });
    receipt = await tx.wait();
    console.log('  checkTimerExpiry:', receipt.status === 1 ? '成功' : '失败');
  } catch(e) {
    console.log('  checkTimerExpiry 失败:', e.code || 'error');
  }

  const phase1 = await managerContract.currentPhase();
  console.log('  调用后阶段:', phase1.toString());

  // 6. triggerDraw
  if (phase1.toString() === '1') {
    console.log('\n6. 调用 triggerDraw...');
    try {
      tx = await managerContract.triggerDraw({ gasLimit: 500000 });
      receipt = await tx.wait();
      console.log('  triggerDraw:', receipt.status === 1 ? '成功' : '失败');

      // 解析 WinnersPicked 事件
      const iface = new ethers.utils.Interface(artifact.abi);
      for (const log of receipt.logs) {
        try {
          const desc = iface.parseLog(log);
          if (desc.name === 'WinnersPicked') {
            console.log('\n  🎉 中奖者:');
            console.log('  w1 (一等奖):', desc.args.w1, '-', ethers.utils.formatEther(desc.args.p1), 'ETH');
            console.log('  w2 (二等奖):', desc.args.w2, '-', ethers.utils.formatEther(desc.args.p2), 'ETH');
            console.log('  w3 (三等奖):', desc.args.w3, '-', ethers.utils.formatEther(desc.args.p3), 'ETH');
          }
        } catch(e) {}
      }
    } catch(e) {
      console.log('  triggerDraw 失败:', e.code || 'error');
      console.log('  错误信息:', e.error?.message || e.message?.split('\n')[0]);
    }
  }

  // 7. 检查新轮次
  console.log('\n7. 检查轮次状态...');
  const round = await managerContract.round();
  const newPhase = await managerContract.currentPhase();
  const newTickets = await managerContract.getTotalTickets();
  console.log('  新轮次:', round.toString(), ', 阶段:', newPhase.toString(), ', 票数:', newTickets.toString());
  const newEnd = await managerContract.endTime();
  console.log('  新结束时间:', new Date(newEnd.toNumber()*1000).toISOString());
}

main().catch(e => {
  console.error('\n测试失败:', e);
  process.exit(1);
});
