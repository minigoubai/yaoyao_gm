const { ethers } = require('hardhat');
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const factory = await ethers.getContractFactory('GiwaLotteryV2');
  const contract = await factory.deploy({ gasLimit: 3000000 });
  await contract.deployed();
  console.log('Deployed to:', contract.address);
  
  // configure
  const tx = await contract.configure(
    ethers.utils.parseEther('0.001'),
    50,
    3600
  );
  await tx.wait();
  console.log('Configured');
  
  // save
  const d = JSON.parse(fs.readFileSync('deployed.json', 'utf8'));
  d.contractAddress = contract.address;
  d.transactionHash = contract.deployTransaction.hash;
  fs.writeFileSync('deployed.json', JSON.stringify(d, null, 2));
  console.log('deployed.json updated');
}

main().catch(e => { console.error(e.message.split('\n')[0]); process.exit(1); });
