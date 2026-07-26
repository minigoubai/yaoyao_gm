import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const addr = '0x67188cd91165aBb197c5a02574c20a40F95Cd93B';
const manager = '0xC43943A9FFe891e175cb21190e642831e6403259';

// 用高 gas limit 尝试 view 函数调用
const overrides = { gasLimit: 5000000 };

// MANAGER()
try {
  const r = await provider.call({ to: addr, data: '0xfee2b4b0' }, 'latest');
  console.log('MANAGER():', r);
} catch(e) {
  // Try with estimate
  console.log('MANAGER() failed:', e.code);
}

// 查看该地址是否是我们的合约 - 检查是否是 proxy
const implSlot = '0x360894a14ba76253c3a173d95059f3e1f218fb0fa2ce6e1a9b0cde8254e4a9c3';
try {
  const impl = await provider.getStorageAt(addr, implSlot);
  console.log('Implementation slot:', impl);
} catch(e) {}

// 查区块浏览器
console.log('\nExplorer: https://sepolia-explorer.giwa.io/address/' + addr);

// 查 manager 部署的所有合约
console.log('\nManager deploys:');
const nonce = await provider.getTransactionCount(manager);
console.log('Manager nonce at deployment (est):', nonce);

// 找我们当时部署的那笔交易
// deployed.json says 2026-07-25T12:04:48
// Let's estimate block - GIWA Sepolia block time unknown, let's check
const latestBlock = await provider.getBlockNumber();
console.log('Latest block:', latestBlock);
const blockTime = await provider.getBlock(latestBlock);
console.log('Block timestamp:', new Date(blockTime.timestamp * 1000).toISOString());
