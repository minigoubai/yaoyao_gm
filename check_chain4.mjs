import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const manager = '0xC43943A9FFe891e175cb21190e642831e6403259';

// 查 manager 当前的 nonce
const nonce = await provider.getTransactionCount(manager, 'pending');
console.log('Current nonce (pending):', parseInt(nonce));
const nonceLatest = await provider.getTransactionCount(manager, 'latest');
console.log('Current nonce (latest):', parseInt(nonceLatest));

// 当前部署钱包余额
const bal = await provider.getBalance(manager);
console.log('Balance:', ethers.utils.formatEther(bal), 'ETH');

// 找在 GIWA Sepolia 上 manager 地址的 CREATE 交易
// 查当前 nonce 的交易（如果部署了的话）
for (let n = 0; n <= parseInt(nonceLatest); n++) {
  try {
    const txHash = await provider.send('eth_getTransactionByBlockNumberAndIndex', [
      '0x' + (await provider.getBlockNumber()).toString(16),
      '0x0'
    ]);
  } catch(e) {}
}

// 直接找 manager 作为 from 的交易
console.log('\n检查区块 31639500 附近:');
for (let b = 31639500; b <= 31639599; b++) {
  try {
    const block = await provider.getBlock(b, false);
    if (block && block.transactions) {
      for (const h of block.transactions) {
        const t = await provider.getTransaction(h);
        if (t && t.from && t.from.toLowerCase() === manager.toLowerCase() && t.to === null) {
          console.log(`Found deployment at block ${b}:`);
          console.log('  tx hash:', t.hash);
          console.log('  nonce:', t.nonce);
          console.log('  contractAddress in receipt: (need receipt)');
          const rcpt = await provider.getTransactionReceipt(t.hash);
          if (rcpt) console.log('  contractAddress:', rcpt.contractAddress);
        }
      }
    }
  } catch(e) {}
}
