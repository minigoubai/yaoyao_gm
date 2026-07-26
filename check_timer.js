#!/usr/bin/env node
/**
 * GIWA Lottery V4 定时开奖脚本
 * 调用 checkTimerExpiry() 检查是否到达定时开奖时间
 * V4 极简流程: 购票 -> 时间到自动开奖 -> 发奖 -> 下一轮
 */
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://sepolia-rpc.giwa.io';
const ADDR = process.env.CONTRACT_ADDRESS || '0x45473C33C9EE4C94476Abf4D5B8C278405CeA48F';
const PK = process.env.DEPLOYER_PRIVATE_KEY;

if (!PK) {
  console.error('需要设置 DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json', 'utf8'));
  const c = new ethers.Contract(ADDR, artifact.abi, wallet);

  const [,,, start, end, phase, totalTickets, pool] = await c.getConfig();
  const now = Math.floor(Date.now() / 1000);
  const endBN = ethers.BigNumber.from(end);
  const phaseNum = Number(phase);
  const ticketsNum = Number(totalTickets);

  console.log(`[${new Date().toISOString()}] 检查合约状态...`);
  console.log(`  Phase: ${phaseNum} (0=购票,1=开奖), 总票数: ${totalTickets}`);
  console.log(`  奖池: ${ethers.utils.formatEther(pool)} ETH`);
  const endTime = endBN.toNumber();
  console.log(`  结束时间: ${endTime ? new Date(endTime*1000).toISOString() : '无'}`);

  // V4: 阶段0(购票)时检查定时; 阶段1(开奖)时任何人可触发triggerDraw
  if (phaseNum === 0) {
    if (endBN.gt(0) && now >= endTime) {
      console.log('  -> 定时到期，调用 checkTimerExpiry!');
      try {
        const tx = await c.checkTimerExpiry({ gasLimit: 100000 });
        await tx.wait();
        console.log('  -> checkTimerExpiry 成功，阶段已切换到开奖');
      } catch(e) {
        console.log('  -> checkTimerExpiry 失败:', e.message.split('\n')[0]);
      }
    } else {
      const remaining = endTime - now;
      console.log(`  -> 未触发 (购票中，距离开奖还有 ${Math.floor(remaining/60)} 分钟)`);
    }
  } else if (phaseNum === 1) {
    console.log('  -> 阶段1(开奖中)，触发 triggerDraw!');
    try {
      const tx = await c.triggerDraw({ gasLimit: 500000 });
      await tx.wait();
      console.log('  -> triggerDraw 成功!');
    } catch(e) {
      console.log('  -> triggerDraw 失败:', e.message.split('\n')[0]);
    }
  }
}

main().catch(e => { console.error('错误:', e.message); process.exit(1); });
