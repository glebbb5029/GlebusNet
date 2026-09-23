import { ethers } from "ethers";

const RPC_URL = "https://glebusnet.onrender.com";

const RECIPIENT =
    "0x86605bd244F6718804D4e30F25c6B31e4D4F0528";

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Hardhat account #0 — тестовый аккаунт
const signer = await provider.getSigner(0);

console.log("Отправитель:", await signer.getAddress());
console.log("Получатель:", RECIPIENT);

const tx = await signer.sendTransaction({
    to: RECIPIENT,
    value: ethers.parseEther("1")
});

console.log("Транзакция газа:", tx.hash);

await tx.wait();

console.log("Готово!");
console.log("На кошелёк отправлен 1 нативный GLB.");