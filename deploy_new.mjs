import { ethers } from 'ethers';
import { readFileSync } from 'fs';

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);

console.log('Wallet:', wallet.address);
console.log('Balance:', ethers.utils.formatEther(await provider.getBalance(wallet.address)), 'ETH');

const artifact = JSON.parse(readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

console.log('Deploying GiwaLotteryV2...');
const contract = await factory.deploy({ gasLimit: 5000000 });
console.log('TX sent, waiting...');
await contract.deployed();
console.log('Deployed at:', contract.address);

// 验证
const manager = await contract.MANAGER();
console.log('MANAGER():', manager);
const config = await contract.getConfig();
console.log('Ticket price:', ethers.utils.formatEther(config._ticketPrice), 'ETH');
