import { ethers } from "ethers";

const RPC_URL = "https://glebusnet.onrender.com";

const TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const wallet1 = "0x86605bd244F6718804D4e30F25c6B31e4D4F0528";
const wallet2 = "0x605cd4AD0dA00423350b53922dB4f492e6d75c2B";

const provider = new ethers.JsonRpcProvider(RPC_URL);

const token = new ethers.Contract(
    TOKEN,
    [
        "function balanceOf(address account) view returns (uint256)",
        "function totalSupply() view returns (uint256)"
    ],
    provider
);

console.log("Проверяем GlebusNet...");
console.log("");

console.log("Кошелёк 1:", wallet1);
console.log(
    "Баланс:",
    ethers.formatUnits(await token.balanceOf(wallet1), 18),
    "GLB"
);

console.log("");

console.log("Кошелёк 2:", wallet2);
console.log(
    "Баланс:",
    ethers.formatUnits(await token.balanceOf(wallet2), 18),
    "GLB"
);

console.log("");

console.log(
    "Total Supply:",
    ethers.formatUnits(await token.totalSupply(), 18),
    "GLB"
);