import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
console.log('Wallet:', wallet.address);

const abi = JSON.parse(fs.readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
const bytecode = abi.bytecode;

const factory = new ethers.ContractFactory(abi.abi, bytecode, wallet);
const contract = await factory.deploy({ gasLimit: 3000000 });
await contract.deployed();
console.log('Deployed to:', contract.address);

const tx = await contract.configure(ethers.utils.parseEther('0.001'), 50, 3600);
await tx.wait();
console.log('Configured');

// 更新 deployed.json
const d = JSON.parse(fs.readFileSync('deployed.json', 'utf8'));
d.contractAddress = contract.address;
fs.writeFileSync('deployed.json', JSON.stringify(d, null, 2));
console.log('Updated deployed.json');
