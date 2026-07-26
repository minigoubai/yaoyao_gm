const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

// 直接用 provider.getSigner 创建 signer
const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);
console.log('Wallet address:', wallet.address);
console.log('Checksum test:', ethers.utils.getAddress('0xba8224e866122b3ec3e11ee4f6f84074b2555fc'));
