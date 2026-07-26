import { ethers } from 'ethers';
import { readFileSync } from 'fs';
const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const addr = '0x8aD04D5ce715A81f33805813F514ABb61899C2C2';
const abi = JSON.parse(readFileSync('./contracts/lottery_abi.json', 'utf8'));
const c = new ethers.Contract(addr, abi, provider);

const userAddr = '0xeC82fA0B5956f0FE2C4Ab4dd12B4514127787350';

// 检查几个关键 storage slot
// 0: round() → SimpleStorage: round
// 1: currentPhase() → SimpleStorage: currentPhase
// 2: ticketPrice → SimpleStorage: ticketPrice
// 3: maxPlayers → SimpleStorage: maxPlayers
// 4: lotteryDuration → SimpleStorage: lotteryDuration
// 5: prizePool → SimpleStorage: prizePool
// 6: manager → SimpleStorage: manager
// 7: startTime → SimpleStorage: startTime
// 8: endTime → SimpleStorage: endTime
// 9: totalTickets → SimpleStorage: totalTickets
// 10: managerFeeBp → SimpleStorage: managerFeeBp

const slotNames = ['round','currentPhase','ticketPrice','maxPlayers','lotteryDuration','prizePool','manager','startTime','endTime','totalTickets','managerFeeBp'];
for (let i = 0; i < 11; i++) {
  const val = await provider.getStorageAt(addr, i);
  console.log(`slot[${i}] ${slotNames[i]}: ${val}`);
}

// Check ticketCount mapping for user address
// ticketCount is a mapping(address => uint256)
// slot for ticketCount[userAddr] = keccak256(userAddr . slot_of_ticketCount_var)
const ticketCountSlot = 11; // depends on contract layout
const userTicketCountSlot = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [userAddr, ticketCountSlot])
);
const userTicketCount = await provider.getStorageAt(addr, userTicketCountSlot);
console.log('\nUser ticketCount storage at slot:', userTicketCountSlot, '=', userTicketCount);

// Check players array
// players is address[]
// players slot = storage slot of players variable
// players.length at that slot
const playersSlot = 12; // adjust based on contract layout
const playersLen = await provider.getStorageAt(addr, ethers.utils.keccak256(ethers.utils.solidityKeccak256(['uint256'], [playersSlot])));
console.log('\nPlayers array length at slot', playersSlot, ':', playersLen);

// Check uniquePlayers array
const uniquePlayersSlot = 13;
const uniquePlayersLen = await provider.getStorageAt(addr, ethers.utils.keccak256(ethers.utils.solidityKeccak256(['uint256'], [uniquePlayersSlot])));
console.log('UniquePlayers array length at slot', uniquePlayersSlot, ':', uniquePlayersLen);

// Check winners array
const winnersSlot = 14;
const winnersLen = await provider.getStorageAt(addr, ethers.utils.keccak256(ethers.utils.solidityKeccak256(['uint256'], [winnersSlot])));
console.log('Winners array length at slot', winnersSlot, ':', winnersLen);
