const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
const artifact = JSON.parse(readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
const addr = '0x8aD04D5ce715A81f33805813F514ABb61899C2C2';

const c = new ethers.Contract(addr, artifact.abi, wallet);

async function main() {
  console.log('Contract:', addr);
  // 3 args: _price, _max, _dur
  const tx = await c.configure('1000000000000000', 50, 3600, { gasLimit: 200000 });
  await tx.wait();
  console.log('Configured!');
  const config = await c.getConfig();
  console.log('Price:', ethers.utils.formatEther(config._ticketPrice), 'ETH');
  console.log('Max:', config._maxPlayers.toString());
  console.log('Duration:', config._duration.toString(), 'sec');
  console.log('Phase:', config._phase.toString());
}
main().catch(e => console.error(e.message));
