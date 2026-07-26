const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
const abi = JSON.parse(readFileSync('./contracts/lottery_abi.json'));

// 用 ethers.Contract 直接传字符串地址，让 provider 处理 checksum
const addr = '0xba8224e866122b3ec3e11ee4f6f84074b2555fc';
const contract = new ethers.Contract(addr, abi, wallet);

async function main() {
  // 先检查合约是否存在
  const code = await provider.getCode(addr);
  console.log('Contract code length:', code.length);
  
  console.log('Configuring...');
  const tx = await contract.configure('1000000000000000', 50, 3600, 1000, { gasLimit: 200000 });
  await tx.wait();
  console.log('Done!');
  
  const config = await contract.getConfig();
  console.log('Price:', config._ticketPrice.toString());
  console.log('Max players:', config._maxPlayers.toString());
  console.log('Duration:', config._duration.toString());
  console.log('Phase:', config._phase.toString());
}
main().catch(e => console.error(e.message));
