const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
const abi = JSON.parse(readFileSync('./contracts/lottery_abi.json'));
const addr = '0xba8224e866122b3ec3e11ee4f6f84074b2555fc';

async function main() {
  // 确认合约存在
  const code = await provider.getCode(addr);
  console.log('Contract code length:', code.length);
  if (code.length < 100) { console.log('No contract! Need to deploy first.'); return; }

  // 用 Contract 对象（它接受小写地址）
  const c = new ethers.Contract(addr, abi, wallet);

  // 测试调用
  try {
    const m = await c.MANAGER();
    console.log('MANAGER():', m);
  } catch(e) {
    console.log('MANAGER() failed:', e.message.slice(0, 80));
  }

  // 尝试 configure
  console.log('Calling configure...');
  try {
    const tx = await c.configure('1000000000000000', 50, 3600, 1000, { gasLimit: 200000 });
    await tx.wait();
    console.log('Configure success!');
    const config = await c.getConfig();
    console.log('Price:', config._ticketPrice.toString());
    console.log('Max:', config._maxPlayers.toString());
    console.log('Duration:', config._duration.toString());
    console.log('Phase:', config._phase.toString());
    console.log('Contract address:', addr);
  } catch(e) {
    console.log('Configure failed:', e.message.slice(0, 120));
  }
}
main().catch(e => console.error(e.message));
