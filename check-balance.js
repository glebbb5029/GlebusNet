import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
    "https://glebusnet.onrender.com"
);

// Кошелек, баланс которого проверяем
const address =
    "0xad7a139f228ae5214615eff5c4893de5ce7edee0";

// Контракт GLB
const TOKEN =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const token = new ethers.Contract(
    TOKEN,
    [
        "function balanceOf(address) view returns (uint256)"
    ],
    provider
);

const nativeBalance =
    await provider.getBalance(address);

const tokenBalance =
    await token.balanceOf(address);

console.log("Адрес:", address);

console.log(
    "GAS:",
    ethers.formatEther(nativeBalance),
    "GAS"
);

console.log(
    "GLB:",
    ethers.formatUnits(tokenBalance, 18),
    "GLB"
);