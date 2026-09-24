import "dotenv/config";
import pg from "pg";
import http from "http";
import { spawn } from "child_process";
import fs from "fs";
import { ethers } from "ethers";

const { Pool } = pg;

// =================================
// НАСТРОЙКИ NEON
// =================================

const db = new Pool({
    host: "ep-divine-shape-b2ww54u3-pooler.c-6.eu-central-1.aws.neon.tech",
    port: 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: "neondb",

    ssl: {
        rejectUnauthorized: false
    },

    family: 4,

    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5
});

db.on("error", (error) => {
    console.error("Neon pool error:", error.message);
});

// =================================
// НАСТРОЙКИ GLEBUSNET
// =================================

const PUBLIC_PORT =
    Number(process.env.PORT || 3000);

const RPC_PORT = 8545;

const CHAIN_ID = 7777;

const OWNER_ADDRESS =
    ethers.getAddress(
        "0xad7a139f228ae5214615eff5c4893de5ce7edee0"
    );

const GAS_AMOUNT =
    ethers.parseEther("1");

const INITIAL_SUPPLY =
    ethers.parseUnits("1000000", 18);

const OWNER_GLB_AMOUNT =
    ethers.parseUnits("100000", 18);

const LOCAL_RPC =
    `http://127.0.0.1:${RPC_PORT}`;

// =================================
// УТИЛИТЫ
// =================================

const sleep = (ms) =>
    new Promise((resolve) =>
        setTimeout(resolve, ms)
    );

function getProvider() {
    return new ethers.JsonRpcProvider(
        LOCAL_RPC
    );
}

function getArtifact() {
    return JSON.parse(
        fs.readFileSync(
            "./artifacts/contracts/GlebusToken.sol/GlebusToken.json",
            "utf8"
        )
    );
}

// =================================
// СОХРАНЕНИЕ БЛОКА
// =================================

async function saveBlock(
    provider,
    blockNumber
) {
    if (
        blockNumber === null ||
        blockNumber === undefined
    ) {
        return;
    }

    const block =
        await provider.getBlock(
            blockNumber,
            false
        );

    if (!block) {
        return;
    }

    await db.query(
        `
        INSERT INTO blocks (
            number,
            hash,
            parent_hash,
            timestamp,
            data
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
        )
        ON CONFLICT (number)
        DO UPDATE SET
            hash = EXCLUDED.hash,
            parent_hash = EXCLUDED.parent_hash,
            timestamp = EXCLUDED.timestamp,
            data = EXCLUDED.data
        `,
        [
            block.number,
            block.hash,
            block.parentHash,
            block.timestamp,
            JSON.stringify({
                number: block.number,
                hash: block.hash,
                parentHash: block.parentHash,
                timestamp: block.timestamp,
                gasLimit:
                    block.gasLimit?.toString() ?? null,
                gasUsed:
                    block.gasUsed?.toString() ?? null,
                miner:
                    block.miner ?? null,
                baseFeePerGas:
                    block.baseFeePerGas?.toString() ?? null
            })
        ]
    );
}

// =================================
// СОХРАНЕНИЕ ТРАНЗАКЦИИ
// =================================

async function saveTransaction(
    provider,
    txHash,
    rawTransaction = null
) {
    const transaction =
        await provider.getTransaction(
            txHash
        );

    if (!transaction) {
        return null;
    }

    const receipt =
        await provider.getTransactionReceipt(
            txHash
        );

    if (!receipt) {
        return null;
    }

    await db.query(
        `
        INSERT INTO transactions (
            hash,
            block_number,
            from_address,
            to_address,
            value,
            gas_used,
            gas_price,
            data
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
        )
        ON CONFLICT (hash)
        DO UPDATE SET
            block_number = EXCLUDED.block_number,
            from_address = EXCLUDED.from_address,
            to_address = EXCLUDED.to_address,
            value = EXCLUDED.value,
            gas_used = EXCLUDED.gas_used,
            gas_price = EXCLUDED.gas_price,
            data = EXCLUDED.data
        `,
        [
            transaction.hash,
            receipt.blockNumber,
            transaction.from,
            transaction.to ?? null,
            transaction.value?.toString() ?? "0",
            receipt.gasUsed?.toString() ?? "0",
            transaction.gasPrice?.toString() ?? "0",
            transaction.data ?? ""
        ]
    );

    // Сохраняем raw-транзакцию,
    // если она у нас есть.
    if (rawTransaction) {
        await db.query(
            `
            INSERT INTO persisted_transactions (
                tx_hash,
                raw_transaction,
                block_number,
                from_address,
                to_address,
                value,
                nonce,
                gas_limit,
                gas_price,
                data,
                chain_id
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11
            )
            ON CONFLICT (tx_hash)
            DO UPDATE SET
                raw_transaction =
                    COALESCE(
                        persisted_transactions.raw_transaction,
                        EXCLUDED.raw_transaction
                    ),
                block_number =
                    COALESCE(
                        persisted_transactions.block_number,
                        EXCLUDED.block_number
                    ),
                from_address =
                    COALESCE(
                        persisted_transactions.from_address,
                        EXCLUDED.from_address
                    ),
                to_address =
                    COALESCE(
                        persisted_transactions.to_address,
                        EXCLUDED.to_address
                    ),
                value =
                    COALESCE(
                        persisted_transactions.value,
                        EXCLUDED.value
                    ),
                nonce =
                    COALESCE(
                        persisted_transactions.nonce,
                        EXCLUDED.nonce
                    ),
                gas_limit =
                    COALESCE(
                        persisted_transactions.gas_limit,
                        EXCLUDED.gas_limit
                    ),
                gas_price =
                    COALESCE(
                        persisted_transactions.gas_price,
                        EXCLUDED.gas_price
                    ),
                data =
                    COALESCE(
                        persisted_transactions.data,
                        EXCLUDED.data
                    ),
                chain_id =
                    COALESCE(
                        persisted_transactions.chain_id,
                        EXCLUDED.chain_id
                    )
            `,
            [
                transaction.hash,
                rawTransaction,
                receipt.blockNumber,
                transaction.from,
                transaction.to ?? null,
                transaction.value?.toString() ?? "0",
                transaction.nonce,
                transaction.gasLimit?.toString() ?? null,
                transaction.gasPrice?.toString() ?? null,
                transaction.data ?? "",
                transaction.chainId ?? CHAIN_ID
            ]
        );
    }

    await saveBlock(
        provider,
        receipt.blockNumber
    );

    return transaction;
}

// =================================
// СОХРАНЕНИЕ GAS-БАЛАНСА
// =================================

async function saveAccount(
    provider,
    address
) {
    if (!address) {
        return;
    }

    let normalized;

    try {
        normalized =
            ethers.getAddress(address);
    } catch {
        return;
    }

    const balance =
        await provider.getBalance(
            normalized
        );

    const nonce =
        await provider.getTransactionCount(
            normalized
        );

    await db.query(
        `
        INSERT INTO accounts (
            address,
            balance,
            nonce
        )
        VALUES (
            $1,
            $2,
            $3
        )
        ON CONFLICT (address)
        DO UPDATE SET
            balance = EXCLUDED.balance,
            nonce = EXCLUDED.nonce,
            updated_at = NOW()
        `,
        [
            normalized.toLowerCase(),
            balance.toString(),
            nonce
        ]
    );
}

// =================================
// СОХРАНЕНИЕ GLB-БАЛАНСА
// =================================

async function saveTokenBalance(
    tokenAddress,
    walletAddress
) {
    if (
        !tokenAddress ||
        !walletAddress
    ) {
        return;
    }

    try {
        const artifact =
            getArtifact();

        const provider =
            getProvider();

        const token =
            new ethers.Contract(
                tokenAddress,
                artifact.abi,
                provider
            );

        const normalized =
            ethers.getAddress(
                walletAddress
            );

        const balance =
            await token.balanceOf(
                normalized
            );

        await db.query(
            `
            INSERT INTO token_balances (
                token_address,
                wallet_address,
                balance
            )
            VALUES (
                $1,
                $2,
                $3
            )
            ON CONFLICT (
                token_address,
                wallet_address
            )
            DO UPDATE SET
                balance = EXCLUDED.balance,
                updated_at = NOW()
            `,
            [
                tokenAddress.toLowerCase(),
                normalized.toLowerCase(),
                balance.toString()
            ]
        );
    } catch (error) {
        console.error(
            "Failed to save GLB balance:",
            error.message
        );
    }
}

// =================================
// СОХРАНЕНИЕ СОСТОЯНИЯ СЕТИ
// =================================

async function saveChainState(
    tokenAddress
) {
    await db.query(
        `
        INSERT INTO chain_state (
            id,
            chain_id,
            token_address
        )
        VALUES (
            1,
            $1,
            $2
        )
        ON CONFLICT (id)
        DO UPDATE SET
            chain_id = EXCLUDED.chain_id,
            token_address = EXCLUDED.token_address,
            updated_at = NOW()
        `,
        [
            CHAIN_ID,
            tokenAddress
        ]
    );
}

// =================================
// ПОЛНАЯ СИНХРОНИЗАЦИЯ ТРАНЗАКЦИИ
// =================================

async function persistTransaction(
    provider,
    txHash,
    rawTransaction = null,
    tokenAddress = null
) {
    const transaction =
        await saveTransaction(
            provider,
            txHash,
            rawTransaction
        );

    if (!transaction) {
        return;
    }

    // GAS отправителя
    await saveAccount(
        provider,
        transaction.from
    );

    // GAS получателя
    if (transaction.to) {
        await saveAccount(
            provider,
            transaction.to
        );
    }

    if (!tokenAddress) {
        return;
    }

    const transactionTo =
        transaction.to?.toLowerCase();

    const token =
        tokenAddress.toLowerCase();

    if (transactionTo !== token) {
        return;
    }

    if (
        transaction.data &&
        transaction.data.startsWith(
            "0xa9059cbb"
        )
    ) {
        try {
            const iface =
                new ethers.Interface([
                    "function transfer(address to,uint256 amount)"
                ]);

            const decoded =
                iface.decodeFunctionData(
                    "transfer",
                    transaction.data
                );

            await saveTokenBalance(
                tokenAddress,
                transaction.from
            );

            await saveTokenBalance(
                tokenAddress,
                decoded[0]
            );

            console.log(
                "GLB balances saved:",
                transaction.from,
                "->",
                decoded[0]
            );
        } catch (error) {
            console.error(
                "Failed to decode GLB transfer:",
                error.message
            );
        }
    }
}

// =================================
// СОЗДАНИЕ БАЗОВОГО СОСТОЯНИЯ
// =================================

async function createBaseState() {
    const provider =
        getProvider();

    const wallet =
        await provider.getSigner(0);

    const artifact =
        getArtifact();

    const factory =
        new ethers.ContractFactory(
            artifact.abi,
            artifact.bytecode,
            wallet
        );

    console.log(
        "Creating base GLB contract..."
    );

    const token =
        await factory.deploy(
            INITIAL_SUPPLY
        );

    const deploymentReceipt =
        await token.deploymentTransaction()
            .wait();

    await token.waitForDeployment();

    const tokenAddress =
        await token.getAddress();

    console.log(
        "Contract address:",
        tokenAddress
    );

    // =================================
    // Deployment
    // =================================

    if (deploymentReceipt) {
        await saveTransaction(
            provider,
            deploymentReceipt.hash
        );
    }

    // =================================
    // 1 GAS владельцу
    // =================================

    const gasTx =
        await wallet.sendTransaction({
            to: OWNER_ADDRESS,
            value: GAS_AMOUNT
        });

    await gasTx.wait();

    console.log(
        "Base state: 1 GAS sent to:",
        OWNER_ADDRESS
    );

    await saveTransaction(
        provider,
        gasTx.hash
    );

    // =================================
    // 100 000 GLB владельцу
    // =================================

    const tokenTx =
        await token.transfer(
            OWNER_ADDRESS,
            OWNER_GLB_AMOUNT
        );

    await tokenTx.wait();

    console.log(
        "Base state: 100,000 GLB sent to:",
        OWNER_ADDRESS
    );

    await saveTransaction(
        provider,
        tokenTx.hash
    );

    // =================================
    // Состояние сети
    // =================================

    await saveChainState(
        tokenAddress
    );

    // =================================
    // Владелец
    // =================================

    await saveAccount(
        provider,
        OWNER_ADDRESS
    );

    await saveTokenBalance(
        tokenAddress,
        OWNER_ADDRESS
    );

    console.log(
        "Base state saved to Neon."
    );

    return tokenAddress;
}

// =================================
// ВОССТАНОВЛЕНИЕ GLB-ТРАНЗАКЦИЙ
// =================================

async function restoreTransactions(
    tokenAddress
) {
    const provider =
        getProvider();

    const artifact =
        getArtifact();

    const iface =
        new ethers.Interface([
            "function transfer(address to,uint256 amount)"
        ]);

    console.log(
        "Searching Neon for saved GLB transfers..."
    );

    // Берём именно transactions,
    // потому что eth_sendTransaction
    // не обязательно имеет raw_transaction.
    const result =
        await db.query(
            `
            SELECT
                hash,
                block_number,
                from_address,
                to_address,
                data
            FROM transactions
            WHERE block_number >= 4
              AND to_address IS NOT NULL
              AND LOWER(to_address) = LOWER($1)
              AND data IS NOT NULL
              AND LOWER(data) LIKE '0xa9059cbb%'
            ORDER BY block_number ASC
            `,
            [tokenAddress]
        );

    if (
        result.rows.length === 0
    ) {
        console.log(
            "No external GLB transactions to restore."
        );

        return;
    }

    console.log(
        `Found ${result.rows.length} saved GLB transaction(s).`
    );

    // Получаем Hardhat signer #0.
    const signer =
        await provider.getSigner(0);

    const signerAddress =
        await signer.getAddress();

    for (
        const row
        of result.rows
    ) {
        console.log(
            "Restoring GLB transaction:",
            row.hash
        );

        try {
            const decoded =
                iface.decodeFunctionData(
                    "transfer",
                    row.data
                );

            const recipient =
                ethers.getAddress(
                    decoded[0]
                );

            const amount =
                decoded[1];

            const originalSender =
                ethers.getAddress(
                    row.from_address
                );

            // =================================
            // В текущей архитектуре мы можем
            // воспроизвести транзакцию только
            // если её отправитель контролируется
            // Hardhat.
            // =================================

            if (
                originalSender.toLowerCase() !==
                signerAddress.toLowerCase()
            ) {
                console.log(
                    "Skipped:",
                    row.hash,
                    "- sender is not Hardhat account #0"
                );

                continue;
            }

            // =================================
            // Выполняем transfer заново.
            // =================================

            const token =
                new ethers.Contract(
                    tokenAddress,
                    artifact.abi,
                    signer
                );

            const tx =
                await token.transfer(
                    recipient,
                    amount
                );

            const receipt =
                await tx.wait();

            console.log(
                "Restored GLB transfer:",
                ethers.formatUnits(
                    amount,
                    18
                ),
                "GLB ->",
                recipient
            );

            console.log(
                "New transaction:",
                receipt.hash
            );

            // Сохраняем новую транзакцию.
            await persistTransaction(
                provider,
                receipt.hash,
                null,
                tokenAddress
            );

        } catch (error) {
            console.error(
                "Failed to restore GLB transaction:",
                row.hash
            );

            console.error(
                error.message
            );
        }
    }

    console.log(
        "GLB transaction restoration completed."
    );
}

// =================================
// СИНХРОНИЗАЦИЯ ПОСЛЕДНЕГО БЛОКА
// =================================

async function syncLatestBlock() {
    const provider =
        getProvider();

    const latest =
        await provider.getBlockNumber();

    await saveBlock(
        provider,
        latest
    );
}

// =================================
// JSON-RPC PROXY
// =================================

async function handleRpcRequest(
    req,
    res
) {
    const chunks = [];

    req.on(
        "data",
        (chunk) => {
            chunks.push(chunk);
        }
    );

    req.on(
        "end",
        () => {
            const body =
                Buffer.concat(chunks);

            let parsed = null;

            try {
                parsed =
                    JSON.parse(
                        body.toString("utf8")
                    );
            } catch {
                parsed = null;
            }

            const requests =
                Array.isArray(parsed)
                    ? parsed
                    : parsed
                        ? [parsed]
                        : [];

            const trackedRequests = [];

            for (
                const request
                of requests
            ) {
                if (
                    request?.method ===
                        "eth_sendRawTransaction" &&
                    Array.isArray(
                        request.params
                    ) &&
                    typeof request.params[0] ===
                        "string"
                ) {
                    trackedRequests.push({
                        id: request.id,
                        method:
                            "eth_sendRawTransaction",
                        raw:
                            request.params[0]
                    });
                }

                if (
                    request?.method ===
                        "eth_sendTransaction"
                ) {
                    trackedRequests.push({
                        id: request.id,
                        method:
                            "eth_sendTransaction",
                        raw: null
                    });
                }
            }

            const headers = {
                ...req.headers,

                host:
                    `127.0.0.1:${RPC_PORT}`,

                "content-length":
                    body.length
            };

            delete headers[
                "transfer-encoding"
            ];

            const proxy =
                http.request(
                    {
                        hostname:
                            "127.0.0.1",

                        port:
                            RPC_PORT,

                        path:
                            req.url,

                        method:
                            req.method,

                        headers
                    },

                    (rpcRes) => {
                        const responseChunks = [];

                        rpcRes.on(
                            "data",
                            (chunk) => {
                                responseChunks.push(
                                    chunk
                                );
                            }
                        );

                        rpcRes.on(
                            "end",
                            async () => {
                                const response =
                                    Buffer.concat(
                                        responseChunks
                                    );

                                res.writeHead(
                                    rpcRes.statusCode ||
                                        500,
                                    rpcRes.headers
                                );

                                res.end(
                                    response
                                );

                                if (
                                    trackedRequests.length ===
                                        0 ||
                                    rpcRes.statusCode !==
                                        200
                                ) {
                                    return;
                                }

                                try {
                                    const json =
                                        JSON.parse(
                                            response.toString(
                                                "utf8"
                                            )
                                        );

                                    const responses =
                                        Array.isArray(json)
                                            ? json
                                            : [json];

                                    const provider =
                                        getProvider();

                                    const chainResult =
                                        await db.query(
                                            `
                                            SELECT token_address
                                            FROM chain_state
                                            WHERE id = 1
                                            LIMIT 1
                                            `
                                        );

                                    const tokenAddress =
                                        chainResult.rows[0]
                                            ?.token_address ??
                                        null;

                                    for (
                                        const tracked
                                        of trackedRequests
                                    ) {
                                        const matchingResponse =
                                            responses.find(
                                                (item) =>
                                                    item.id ===
                                                    tracked.id
                                            );

                                        if (
                                            !matchingResponse ||
                                            typeof matchingResponse.result !==
                                                "string"
                                        ) {
                                            continue;
                                        }

                                        const hash =
                                            matchingResponse.result;

                                        let receipt =
                                            null;

                                        for (
                                            let attempt = 0;
                                            attempt < 30;
                                            attempt++
                                        ) {
                                            receipt =
                                                await provider.getTransactionReceipt(
                                                    hash
                                                );

                                            if (
                                                receipt
                                            ) {
                                                break;
                                            }

                                            await sleep(100);
                                        }

                                        if (!receipt) {
                                            console.log(
                                                "Transaction not mined yet:",
                                                hash
                                            );

                                            continue;
                                        }

                                        await persistTransaction(
                                            provider,
                                            hash,
                                            tracked.raw,
                                            tokenAddress
                                        );

                                        console.log(
                                            "Persisted:",
                                            hash,
                                            `(${tracked.method})`
                                        );
                                    }
                                } catch (error) {
                                    console.error(
                                        "Failed to persist transaction:"
                                    );

                                    console.error(
                                        error.message
                                    );
                                }
                            }
                        );
                    }
                );

            proxy.on(
                "error",
                (error) => {
                    console.error(
                        "RPC proxy error:",
                        error.message
                    );

                    if (
                        !res.headersSent
                    ) {
                        res.writeHead(502);
                    }

                    res.end(
                        "RPC unavailable"
                    );
                }
            );

            proxy.end(body);
        }
    );
}

// =================================
// ЗАПУСК
// =================================

async function start() {

    console.log(
        "Starting GlebusNet..."
    );

    // =================================
    // Neon
    // =================================

    try {
        await db.query(
            "SELECT 1"
        );

        console.log(
            "Neon database connected!"
        );
    } catch (error) {
        console.error(
            "Failed to connect to Neon:"
        );

        console.error(error);

        process.exit(1);
    }

    // =================================
    // Hardhat
    // =================================

    const hardhat =
        spawn(
            process.execPath,
            [
                "./node_modules/hardhat/dist/src/cli.js",
                "node",
                "--hostname",
                "127.0.0.1",
                "--port",
                String(RPC_PORT),
                "--chain-id",
                String(CHAIN_ID)
            ],
            {
                stdio: "inherit"
            }
        );

    hardhat.on(
        "exit",
        (code) => {
            console.log(
                `Hardhat stopped with code ${code}`
            );

            process.exit(
                code ?? 1
            );
        }
    );

    // =================================
    // Ждём Hardhat RPC
    // =================================

    let rpcReady = false;

    for (
        let i = 0;
        i < 30;
        i++
    ) {
        try {
            const provider =
                getProvider();

            const network =
                await provider.getNetwork();

            if (
                Number(network.chainId) !==
                CHAIN_ID
            ) {
                throw new Error(
                    `Wrong chain ID: ${network.chainId}`
                );
            }

            console.log(
                "Hardhat RPC is ready"
            );

            rpcReady = true;

            break;
        } catch {
            console.log(
                "Waiting for Hardhat RPC..."
            );

            await sleep(1000);
        }
    }

    if (!rpcReady) {
        throw new Error(
            "Hardhat RPC did not start"
        );
    }

    // =================================
    // Базовое состояние
    // =================================

    try {
        const tokenAddress =
            await createBaseState();

        // =================================
        // ВОССТАНАВЛИВАЕМ TRANSACTIONS
        // ИЗ NEON
        // =================================

        await restoreTransactions(
            tokenAddress
        );

        // =================================
        // Финальная синхронизация
        // =================================

        await saveAccount(
            getProvider(),
            OWNER_ADDRESS
        );

        await saveTokenBalance(
            tokenAddress,
            OWNER_ADDRESS
        );

        await saveChainState(
            tokenAddress
        );

        await syncLatestBlock();

        console.log(
            "================================="
        );

        console.log(
            "GlebusNet restored"
        );

        console.log(
            "Chain ID:",
            CHAIN_ID
        );

        console.log(
            "GLB token:",
            tokenAddress
        );

        console.log(
            "================================="
        );

    } catch (error) {
        console.error(
            "GlebusNet initialization failed:"
        );

        console.error(error);

        process.exit(1);
    }

    // =================================
    // Публичный RPC
    // =================================

    const server =
        http.createServer(
            handleRpcRequest
        );

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