const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
const artifact = JSON.parse(readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
const addr = '0x8aD04D5ce715A81f33805813F514ABb61899C2C2';
const c = new ethers.Contract(addr, artifact.abi, wallet);

async function main() {
  const config = await c.getConfig();
  console.log('=== 合约状态 ===');
  console.log('Phase:', config._phase.toString(), '(0=参与,1=承诺,2=揭示,3=完成)');
  console.log('票价:', ethers.utils.formatEther(config._ticketPrice), 'ETH');
  console.log('奖池:', ethers.utils.formatEther(config._prizePool), 'ETH');
  console.log('总票数:', config._totalTickets.toString());
  console.log('独立玩家:', config._uniquePlayers.toString());
  console.log('Manager:', config._manager);
  console.log('轮次:', config._round ? config._round.toString() : 'N/A');
  
  // 获取玩家列表
  try {
    const players = await c.getPlayers();
    console.log('\n玩家列表:');
    players.forEach((p, i) => console.log(`  ${i+1}. ${p}`));
  } catch(e) { console.log('getPlayers error'); }
  
  // 合约余额
  const bal = await provider.getBalance(addr);
  console.log('\n合约余额:', ethers.utils.formatEther(bal), 'ETH');
}
main().catch(console.error);
