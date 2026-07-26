const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
const addr = '0xba8224e866122b3ec3e11ee4f6f84074b2555fc';
const abi = JSON.parse(readFileSync('./contracts/lottery_abi.json'));
const contract = new ethers.Contract(addr, abi, wallet);

async function main() {
  console.log('Configuring...');
  const tx = await contract.configure(
    ethers.utils.parseEther('0.001'), 50, 3600, 1000, { gasLimit: 200000 }
  );
  await tx.wait();
  console.log('Done!');
  const config = await contract.getConfig();
  console.log('Price:', ethers.utils.formatEther(config._ticketPrice), 'ETH');
  console.log('Max:', config._maxPlayers.toString());
  console.log('Duration:', config._duration.toString(), 'sec');
  console.log('Phase:', config._phase.toString());
}
main().catch(console.error);
