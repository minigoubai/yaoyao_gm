const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
const artifact = JSON.parse(readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
const addr = '0x8aD04D5ce715A81f33805813F514ABb61899C2C2';
const c = new ethers.Contract(addr, artifact.abi, wallet);

async function main() {
  // 1. 检查当前 phase 和状态
  const config = await c.getConfig();
  console.log('Phase:', config._phase.toString());
  console.log('Ticket price:', config._ticketPrice.toString());
  console.log('Manager:', config._manager);

  // 2. 尝试买 1 张票
  const ticketPrice = config._ticketPrice;
  console.log('\nBuying 1 ticket for', ethers.utils.formatEther(ticketPrice), 'ETH...');
  try {
    const tx = await c.buyTickets(1, { value: ticketPrice, gasLimit: 300000 });
    console.log('TX sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('TX status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    console.log('Gas used:', receipt.gasUsed.toString());
  } catch(e) {
    console.log('Error:', e.message || e.reason || JSON.stringify(e.code));
    // 尝试 decode revert reason
    if (e.data) console.log('Revert data:', e.data);
  }

  // 3. 检查合约余额和奖池
  const balance = await provider.getBalance(addr);
  console.log('\nContract balance:', ethers.utils.formatEther(balance), 'ETH');
}
main().catch(e => console.error('Fatal:', e.message));
