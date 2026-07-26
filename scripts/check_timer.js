#!/usr/bin/env node
/**
 * GIWA Lottery 定时开奖脚本
 * 调用 checkTimerExpiry() 检查是否到达定时开奖时间
 * 同时检查是否满足50人阈值
 */
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://sepolia-rpc.giwa.io';
const ADDR = process.env.CONTRACT_ADDRESS || '0x67188cd91165aBb197c5a02574c20a40F95Cd93B';
const PK = process.env.DEPLOYER_PRIVATE_KEY;

if (!PK) {
  console.error('需要设置 DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
  const c = new ethers.Contract(ADDR, artifact.abi, wallet);

  const [,,, start, end, phase, totalTickets, uniquePlayers, pool] = await c.getConfig();
  const now = Math.floor(Date.now() / 1000);
  const endBN = ethers.BigNumber.from(end);
  const phaseNum = Number(phase);
  const ticketsBN = ethers.BigNumber.from(totalTickets);
  const uniqueBN = ethers.BigNumber.from(uniquePlayers);

  console.log(`[${new Date().toISOString()}] 检查合约状态...`);
  console.log(`  Phase: ${phaseNum}, 总票数: ${totalTickets}, 独立玩家: ${uniquePlayers}`);
  console.log(`  奖池: ${ethers.utils.formatEther(pool)} ETH`);
  console.log(`  结束时间: ${endBN.toNumber() ? new Date(endBN.toNumber()*1000).toISOString() : '无'}`);

  // 条件1: 定时到期
  const timerExpired = phaseNum === 0 && endBN.gt(0) && now >= endBN.toNumber();

  // 条件2: 50人阈值
  const maxPlayers = await c.maxPlayers();
  const maxBN = ethers.BigNumber.from(maxPlayers);
  const thresholdReached = phaseNum === 0 && maxBN.gt(0) && uniqueBN.gte(maxBN);

  if (timerExpired) {
    console.log('  → 定时到期，触发开奖!');
    try {
      const tx = await c.checkTimerExpiry({ gasLimit: 50000 });
      await tx.wait();
      console.log('  → checkTimerExpiry 成功');
    } catch (e) {
      console.log('  → checkTimerExpiry 失败:', e.message.split('\n')[0]);
    }
  } else if (thresholdReached) {
    console.log('  → 50人阈值触发!');
    try {
      const tx = await c.forceStartCommit({ gasLimit: 50000 });
      await tx.wait();
      console.log('  → forceStartCommit 成功');
    } catch (e) {
      console.log('  → forceStartCommit 失败:', e.message.split('\n')[0]);
    }
  } else {
    const remaining = end.toNumber() - now;
    console.log(`  -> 未触发 (距离开奖还有 ${Math.floor(remaining/60)} 分钟)`);
  }
}

main().catch(e => { console.error('错误:', e.message); process.exit(1); });
