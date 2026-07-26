import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const addr = '0x67188cd91165aBb197c5a02574c20a40F95Cd93B';

// 查部署交易 - 通过 Internal Transactions 找 CREATE
// 先获取当前区块高度
const block = await provider.getBlockNumber();
console.log('Current block:', block);

// 查最近的 Deployment 交易 (contract creation)
// eth_getTransactionByBlockNumberAndIndex
for (let i = 0; i < 5; i++) {
  try {
    const tx = await provider.getBlock(block - i, true);
    if (tx && tx.transactions) {
      for (const hash of tx.transactions) {
        const t = await provider.getTransaction(hash);
        if (t && t.to === null) {
          console.log(`Block ${block-i} CREATE:`, t.hash, 'value:', t.value.toString());
        }
      }
    }
  } catch(e) {}
}

// 尝试用不同函数 selector 调用
const selectors = ['0x06fdde03', '0x95d89b41', '0x18160ddd', '0x70a08231'];
for (const sel of selectors) {
  try {
    const r = await provider.call({ to: addr, data: sel + '0000000000000000000000000000000000000000000000000000000000000000' });
    console.log(`Selector ${sel}:`, r);
  } catch(e) {
    console.log(`Selector ${sel}: REVERT`);
  }
}
