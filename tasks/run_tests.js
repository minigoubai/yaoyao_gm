// Run with: npx hardhat task run_tests
const { task } = require('hardhat/config');

task('run_tests', 'Run GiwaLotteryV2 tests').setAction(async (args, hre) => {
  const { ethers } = hre;
  console.log('=== ethers available:', typeof ethers !== 'undefined');
  console.log('=== ethers keys:', Object.keys(ethers || {}).slice(0,10));
  
  const signers = await ethers.getSigners();
  console.log('signers:', signers.length);
  
  const Factory = await ethers.getContractFactory('GiwaLotteryV2', signers[0]);
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  console.log('Deployed:', await contract.getAddress());
  console.log('Manager:', await contract.MANAGER());
  console.log('Phase:', await contract.currentPhase());
  console.log('PASS: deployment test');
});
