const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);

// 合约地址（小写）
const addr = '0xba8224e866122b3ec3e11ee4f6f84074b2555fc';

// configure(bytes32 _price, uint256 _max, uint256 _dur, uint256 _feeBP)
// price = 0.001 ETH = 0x38d7ea4c68000 in hex
const iface = new ethers.utils.Interface([
  'function configure(uint256 _ticketPrice, uint256 _maxPlayers, uint256 _duration, uint256 _managerFeeBp)'
]);
const data = iface.encodeFunctionData('configure', ['1000000000000000', 50, 3600, 1000]);
console.log('Data:', data);

async function main() {
  const tx = {
    to: addr,
    data: data,
    gasLimit: 200000,
    gasPrice: await provider.getGasPrice()
  };
  console.log('Sending configure tx...');
  const sent = await wallet.sendTransaction(tx);
  console.log('TX sent:', sent.hash);
  await sent.wait();
  console.log('TX confirmed!');
  
  // 验证 - 用没有abi的contract对象
  const c = new ethers.Contract(addr, [], wallet);
  const code = await provider.getCode(addr);
  console.log('Code length:', code.length);
}
main().catch(e => console.error('Error:', e.message || e.reason || JSON.stringify(e)));
