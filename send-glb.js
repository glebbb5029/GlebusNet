import { ethers } from "ethers";

const RPC_URL = "https://glebusnet.onrender.com";
const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const RECIPIENT = "0x86605bd244F6718804D4e30F25c6B31e4D4F0528";

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Тестовый аккаунт Hardhat №0
const signer = await provider.getSigner(0);

const token = new ethers.Contract(
    TOKEN_ADDRESS,
    [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)"
    ],
    signer
);

console.log("Отправитель:", await signer.getAddress());
console.log("Получатель:", RECIPIENT);

const amount = ethers.parseUnits("100", 18);

console.log("Отправляем 100 GLB...");

const tx = await token.transfer(RECIPIENT, amount);

console.log("Транзакция:", tx.hash);

await tx.wait();

console.log("Готово! 100 GLB отправлены.");