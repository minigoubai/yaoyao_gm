/**
 * Hardhat 本地测试脚本
 * 运行: npx hardhat run test_deploy.js --network hardhat
 */
const { ethers } = require('hardhat');

async function main() {
  console.log('=== GIWA Lottery V2 完整测试 ===\n');

  // Hardhat 内置账户
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const player1 = signers[1];
  const player2 = signers[2];
  const player3 = signers[3];

  console.log('账户:');
  console.log('  Deployer:', deployer.address);
  console.log('  Player1: ', player1.address);
  console.log('  Player2: ', player2.address);
  console.log('  Player3: ', player3.address);
  console.log();

  // 部署
  const ContractFactory = await ethers.getContractFactory('GiwaLotteryV2', deployer);
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log('✅ 合约部署成功:', addr);
  console.log('   Manager:', await contract.MANAGER());
  console.log('   Phase:', await contract.currentPhase());
  console.log('   Ticket Price:', ethers.formatEther(await contract.ticketPrice()), 'ETH');
  console.log();

  // 配置：阈值3人开奖
  console.log('⚙️  配置：阈值=3人，票价=0.001 ETH');
  await contract.configure(
    ethers.parseEther('0.001'),
    3,
    0,
    1000
  );
  console.log();

  // Player1 买1张票
  console.log('🎟️  Player1 购买 1 张票');
  const ticketPrice = await contract.ticketPrice();
  await contract.connect(player1).buyTickets(1, { value: ticketPrice });
  console.log('   Player1 票数:', (await contract.getTicketCount(player1.address)).toString());

  // Player2 买3张票
  console.log('🎟️  Player2 购买 3 张票');
  await contract.connect(player2).buyTickets(3, { value: ticketPrice.mul(3) });
  console.log('   Player2 票数:', (await contract.getTicketCount(player2.address)).toString());

  // Player3 买2张票
  console.log('🎟️  Player3 购买 2 张票');
  await contract.connect(player3).buyTickets(2, { value: ticketPrice.mul(2) });
  console.log('   Player3 票数:', (await contract.getTicketCount(player3.address)).toString());
  console.log();

  const totalTickets = await contract.getTotalTickets();
  const prizePool = await contract.getPrizePool();
  console.log('📊 当前状态:');
  console.log('   总票数:', totalTickets.toString());
  console.log('   奖池:', ethers.formatEther(prizePool), 'ETH');
  console.log('   阶段:', (await contract.currentPhase()).toString(), '(0=Entry)');
  console.log('   唯一参与人数:', (await contract.getUniquePlayerCount()).toString());
  console.log();

  // Commit
  const randomness1 = 'player1_secret_abc123';
  const randomness2 = 'player2_secret_xyz789';
  const randomness3 = 'player3_secret_qwe456';

  const submitCommit = async (player, randomness) => {
    const indices = await contract.connect(player).getMyTicketIndices(player.address);
    const hashes = [];
    for (const idx of indices) {
      const hash = ethers.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'address', 'uint256'],
          [randomness, player.address, idx]
        )
      );
      hashes.push(hash);
    }
    await contract.connect(player).commitTicketsBatch(indices, hashes);
    console.log(`   ${player.address.slice(0,10)}... 提交了 ${indices.length} 张票承诺`);
  };

  console.log('🔐 Commit 阶段:');
  await submitCommit(player1, randomness1);
  await submitCommit(player2, randomness2);
  await submitCommit(player3, randomness3);
  console.log('   全部提交完成！');
  console.log('   阶段:', (await contract.currentPhase()) === 2 ? 'REVEAL' : 'COMMIT');
  console.log();

  // Reveal
  console.log('🔓 Reveal 阶段:');
  const revealCommit = async (player, randomness) => {
    const indices = await contract.connect(player).getMyTicketIndices(player.address);
    const values = indices.map(() => randomness);
    await contract.connect(player).revealTicketsBatch(indices, values);
    console.log(`   ${player.address.slice(0,10)}... 揭示了 ${indices.length} 张票随机数`);
  };

  await revealCommit(player1, randomness1);
  await revealCommit(player2, randomness2);
  await revealCommit(player3, randomness3);
  console.log();

  // 开奖
  console.log('🎲 开奖!');
  const drawTx = await contract.draw();
  const receipt = await drawTx.wait();

  const iface = contract.interface;
  let winnersEvent;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'WinnersPicked') {
        winnersEvent = parsed;
      }
    } catch(e) {}
  }

  if (winnersEvent) {
    const [w1, p1, w2, p2, w3, p3] = winnersEvent.args;
    console.log('🏆 中奖者:');
    console.log('   🥇 第1名:', w1, '—', ethers.formatEther(p1), 'ETH');
    console.log('   🥈 第2名:', w2, '—', ethers.formatEther(p2), 'ETH');
    console.log('   🥉 第3名:', w3, '—', ethers.formatEther(p3), 'ETH');
  }

  console.log();
  console.log('✅ 完整流程测试通过!');
  console.log('   轮次:', (await contract.round()).toString());
  console.log('   阶段:', (await contract.currentPhase()).toString());
  console.log();
  console.log('========================================');
  console.log('部署命令:');
  console.log('DEPLOYER_PRIVATE_KEY=0x你的私钥 node deploy.js');
  console.log('========================================');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
