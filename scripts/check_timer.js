#!/usr/bin/env node
/**
 * GIWA Lottery V4 定时开奖脚本
 * 调用 checkTimerExpiry() 检查是否到达定时开奖时间（一次性完成开奖，无需两步）
 */
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://sepolia-rpc.giwa.io';
const ADDR = process.env.CONTRACT_ADDRESS;
const PK = process.env.DEPLOYER_PRIVATE_KEY;

if (!PK) {
  console.error('需要设置 DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}
if (!ADDR) {
  console.error('需要设置 CONTRACT_ADDRESS');
  process.exit(1);
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json', 'utf8'));
  const c = new ethers.Contract(ADDR, artifact.abi, wallet);

  // V4 视图函数
  const [ticketPrice, maxPlayers, lotteryDuration, currentPhase, totalRounds] = await Promise.all([
    c.ticketPrice(),
    c.maxPlayers(),
    c.lotteryDuration(),
    c.currentPhase(),
    c.totalRounds(),
  ]);
  const endTime = await c.endTime();
  const pool = await provider.getBalance(ADDR);
  const now = Math.floor(Date.now() / 1000);

  const phaseNum = Number(currentPhase);
  const endBN = ethers.BigNumber.from(endTime);

  console.log(`[${new Date().toISOString()}] Phase: ${phaseNum}, 奖池: ${ethers.utils.formatEther(pool)} ETH`);
  console.log(`  endTime: ${endBN.toNumber() ? new Date(endBN.toNumber()*1000).toISOString() : '无'}`);

  // 仅在 PHASE_ENTRY(0) 且时间已到时触发
  const timerExpired = phaseNum === 0 && endBN.gt(0) && now >= endBN.toNumber();

  if (timerExpired) {
    console.log('  -> 定时到期，触发 checkTimerExpiry (一次性开奖)...');
    try {
      // estimateGas 先估算，避免 intrinsic gas too low
      const est = await c.estimateGas.checkTimerExpiry();
      const gasLimit = est.mul(2).toNumber(); // 2x 估算值
      console.log(`  -> 估算 gas: ${est.toNumber()}, 设置上限: ${gasLimit}`);
      const tx = await c.checkTimerExpiry({ gasLimit });
      const receipt = await tx.wait();
      console.log(`  -> 成功! TX: ${receipt.transactionHash}`);
    } catch (e) {
      // 提取 revert 原因
      let reason = e.message;
      if (e.data) reason = e.data;
      else if (e.error && e.error.body) {
        try {
          const body = JSON.parse(e.error.body);
          reason = body.error.message || reason;
        } catch(_) {}
      }
      console.log('  -> checkTimerExpiry 失败:', reason.split('\n')[0]);
      process.exit(0); // 不重试，静默退出
    }
  } else {
    const remaining = endBN.toNumber() - now;
    console.log(`  -> 未触发 (Phase=${phaseNum}, 距开奖还有 ${Math.max(0, Math.floor(remaining/60))} 分钟)`);
  }
}

main().catch(e => {
  console.error('脚本错误:', e.message.split('\n')[0]);
  process.exit(0); // 不抛异常，避免 cron 重复报警
});
