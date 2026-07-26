#!/usr/bin/env node
/**
 * GIWA Lottery V4 定时开奖脚本
 * 使用原始 HTTPS RPC 调用，避免 ethers.js eth_call 问题
 */
require('dotenv').config();
const https = require('https');

const RPC_HOST = 'sepolia-rpc.giwa.io';
const ADDR = process.env.CONTRACT_ADDRESS || '0x8da04AA8f30C524e438064546f32701623D684c1';
const PK = process.env.DEPLOYER_PRIVATE_KEY;
if (!PK) { console.error('请在 .env 中设置 DEPLOYER_PRIVATE_KEY'); process.exit(1); }

function rpc(method, params) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request({ hostname: RPC_HOST, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(data); req.end();
  });
}

function packAddress(addr) {
  return '0x000000000000000000000000' + addr.slice(2).toLowerCase();
}

async function ethCall(from, to, data) {
  const r = await rpc('eth_call', [{ from, to, data }, 'latest']);
  if (r.error) throw new Error(r.error.message);
  return r.result;
}

async function sendTx(from, to, data, pk) {
  const { ethers } = require('ethers');
  const provider = new ethers.providers.JsonRpcProvider('https://' + RPC_HOST);
  const wallet = new ethers.Wallet(pk, provider);
  const tx = { to, data, chainId: 91342 };
  const signed = await wallet.signTransaction(tx);
  const r = await rpc('eth_sendRawTransaction', [signed]);
  if (r.error) throw new Error(r.error.error?.message || r.error.message);
  // Wait for receipt
  let receipt = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r2 = await rpc('eth_getTransactionReceipt', [r.result]);
    if (r2.result) { receipt = r2.result; break; }
  }
  return receipt;
}

const SELECTORS = {
  currentPhase:   '0x055ad42e',
  round:          '0x146ca531',
  startTime:      '0x78e97925',
  endTime:        '0x3197cbb6',
  getPrizePool:   '0x884bf67c',
  getTotalTickets:'0x06e8337f',
  checkTimerExpiry:'0xf9fa4c52',
  triggerDraw:    '0x825d2ab7',
};

async function main() {
  const fromAddr = '0x0000000000000000000000000000000000000001';
  const now = Math.floor(Date.now() / 1000);

  console.log(`[${new Date().toISOString()}] 检查合约 ${ADDR}...`);

  try {
    const [phaseHex, roundHex, startHex, endHex, poolHex, totalHex] = await Promise.all([
      ethCall(fromAddr, ADDR, SELECTORS.currentPhase),
      ethCall(fromAddr, ADDR, SELECTORS.round),
      ethCall(fromAddr, ADDR, SELECTORS.startTime),
      ethCall(fromAddr, ADDR, SELECTORS.endTime),
      ethCall(fromAddr, ADDR, SELECTORS.getPrizePool),
      ethCall(fromAddr, ADDR, SELECTORS.getTotalTickets),
    ]);

    const phase = parseInt(phaseHex);
    const round = parseInt(roundHex);
    const start = parseInt(startHex);
    const end = parseInt(endHex);
    const pool = parseInt(poolHex) / 1e18;
    const total = parseInt(totalHex);

    console.log(`  Round ${round}, Phase ${phase}, 票数 ${total}, 奖池 ${pool} ETH`);
    console.log(`  结束时间: ${end ? new Date(end * 1000).toISOString() : '无'} (${end - now}s 后)`);

    if (phase === 0) {
      if (end > 0 && now >= end) {
        console.log('  -> 定时到期，调用 checkTimerExpiry!');
        const receipt = await sendTx(null, ADDR, SELECTORS.checkTimerExpiry, PK);
        console.log('  -> 成功! TX:', receipt.transactionHash, 'status:', receipt.status);
      } else {
        console.log(`  -> 购票中，距开奖还有 ${Math.floor((end - now) / 60)} 分钟`);
      }
    } else if (phase === 1) {
      console.log('  -> 开奖阶段，调用 triggerDraw!');
      const receipt = await sendTx(null, ADDR, SELECTORS.triggerDraw, PK);
      console.log('  -> 成功! TX:', receipt.transactionHash, 'status:', receipt.status);
    }
  } catch (e) {
    console.log('  -> 错误:', e.message);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });