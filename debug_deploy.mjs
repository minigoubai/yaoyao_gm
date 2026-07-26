import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const RPC = 'https://sepolia-rpc.giwa.io';
const PK = process.env.DEPLOYER_PRIVATE_KEY;

const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json', 'utf8'));
const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

console.log('Wallet balance:', ethers.utils.formatEther(await wallet.getBalance()), 'ETH');

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
const deployTx = factory.getDeployTransaction();
console.log('Deploy data prefix:', deployTx.data.slice(0, 50));
console.log('Deploy data len:', deployTx.data.length);

console.log('\nSending deployment...');
const tx = await wallet.sendTransaction(deployTx);
console.log('TX hash:', tx.hash);

console.log('Waiting for receipt...');
const receipt = await tx.wait();
console.log('Receipt status:', receipt.status, 'block:', receipt.blockNumber);
console.log('Contract address:', receipt.contractAddress);

if (receipt.contractAddress) {
  const onChain = await provider.getCode(receipt.contractAddress);
  console.log('On-chain prefix:', onChain.slice(0, 30));
  console.log('Matches artifact:', onChain === artifact.bytecode);

  const c = new ethers.Contract(receipt.contractAddress, artifact.abi, wallet);
  try {
    const [phase, price, max] = await Promise.all([c.currentPhase(), c.ticketPrice(), c.maxPlayers()]);
    console.log('\nContract readable: Phase', phase.toString(), ', Price', ethers.utils.formatEther(price), 'ETH, Max', max.toString());
  } catch(e) {
    console.log('\nContract calls failed:', e.message.split('\n')[0]);
  }
} else {
  console.log('No contract address in receipt!');
}
