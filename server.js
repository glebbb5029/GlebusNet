import http from "http";
import { spawn } from "child_process";
import fs from "fs";
import { ethers } from "ethers";

const PUBLIC_PORT = Number(process.env.PORT || 3000);
const RPC_PORT = 8545;

// Публичный адрес кошелька, на который будут отправляться 100 000 GLB.
// Сюда можно указывать ТОЛЬКО публичный адрес.
// Seed-фразу и приватный ключ сюда НЕ вставлять.
const OWNER_ADDRESS = "0x885436e361273f060e8f995761f1a5c69a0a2e17";

console.log("Starting GlebusNet...");

// Запускаем Hardhat node внутри Render
const hardhat = spawn(
    process.execPath,
    [
        "./node_modules/hardhat/dist/src/cli.js",
        "node",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(RPC_PORT),
        "--chain-id",
        "7777"
    ],
    {
        stdio: "inherit"
    }
);

hardhat.on("exit", (code) => {
    console.log(`Hardhat stopped with code ${code}`);
    process.exit(code ?? 1);
});

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

async function deployToken() {
    const provider = new ethers.JsonRpcProvider(
        `http://127.0.0.1:${RPC_PORT}`
    );

    const wallet = await provider.getSigner(0);

    const artifact = JSON.parse(
        fs.readFileSync(
            "./artifacts/contracts/GlebusToken.sol/GlebusToken.json",
            "utf8"
        )
    );

    const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        wallet
    );

    // Создаём 1 000 000 GLB
    const token = await factory.deploy(
        ethers.parseUnits("1000000", 18)
    );

    await token.waitForDeployment();

    const tokenAddress = await token.getAddress();

    // Отправляем 100 000 GLB на указанный кошелёк
    const amount = ethers.parseUnits("100000", 18);

    const tx = await token.transfer(
        OWNER_ADDRESS,
        amount
    );

    await tx.wait();

    console.log("=================================");
    console.log("GlebusNet started");
    console.log("Chain ID: 7777");
    console.log("GLB token:", tokenAddress);
    console.log("100,000 GLB sent to:", OWNER_ADDRESS);
    console.log("Transaction:", tx.hash);
    console.log("=================================");
}

async function start() {
    // Ждём запуска Hardhat
    for (let i = 0; i < 30; i++) {
        try {
            const provider = new ethers.JsonRpcProvider(
                `http://127.0.0.1:${RPC_PORT}`
            );

            await provider.getNetwork();

            console.log("Hardhat RPC is ready");
            break;
        } catch {
            console.log("Waiting for Hardhat RPC...");
            await sleep(1000);
        }

        if (i === 29) {
            throw new Error("Hardhat RPC did not start");
        }
    }

    try {
        await deployToken();
    } catch (error) {
        console.error("Token deployment failed:");
        console.error(error);
        process.exit(1);
    }

    // HTTPS Render -> этот HTTP proxy -> Hardhat RPC
    const server = http.createServer((req, res) => {
        const proxy = http.request(
            {
                hostname: "127.0.0.1",
                port: RPC_PORT,
                path: req.url,
                method: req.method,
                headers: req.headers
            },
            (rpcRes) => {
                res.writeHead(
                    rpcRes.statusCode || 500,
                    rpcRes.headers
                );

                rpcRes.pipe(res);
            }
        );

        proxy.on("error", (error) => {
            console.error("RPC proxy error:", error);

            if (!res.headersSent) {
                res.writeHead(502);
            }

            res.end("RPC unavailable");
        });

        req.pipe(proxy);
    });

    server.listen(
        PUBLIC_PORT,
        "0.0.0.0",
        () => {
            console.log(
                `GlebusNet RPC proxy listening on port ${PUBLIC_PORT}`
            );
        }
    );
}

start();