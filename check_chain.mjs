import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const addr = '0x67188cd91165aBb197c5a02574c20a40F95Cd93B';

const code = await provider.getCode(addr);
console.log('Code length:', code.length, '(0 means no contract)');
if (code === '0x') { console.log('NO CONTRACT at this address!'); process.exit(0); }

// MANAGER() - 0xfee2b4b0
try {
  const manager = await provider.call({ to: addr, data: '0xfee2b4b0' });
  console.log('MANAGER() resp:', manager, '(should be 0x for view revert)');
} catch(e) { console.log('MANAGER() err:', e.code, e.message.slice(0,80)); }
