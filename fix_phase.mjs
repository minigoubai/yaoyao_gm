import { ethers } from 'hardhat';
const pk = '0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4';
const addr = '0x4613Fb36Bc16F6Bf9bb27AeD9bfa9Cf7d3dEE959';
const artifact = require('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json');

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet(pk, provider);
const contract = new ethers.Contract(addr, artifact.abi, wallet);

async function main() {
  const phase = await contract.phase();
  console.log('Current phase:', phase.toString());
  
  const tx = await contract.checkTimerExpiry();
  console.log('TX:', tx.hash);
  await tx.wait();
  
  const newPhase = await contract.phase();
  console.log('New phase:', newPhase.toString());
  const startTime = await contract.startTime();
  console.log('StartTime:', startTime.toString());
  const playerCount = await contract.playerCount();
  console.log('PlayerCount:', playerCount.toString());
  const prizePool = await contract.prizePool();
  console.log('PrizePool:', ethers.utils.formatEther(prizePool), 'ETH');
}

main();