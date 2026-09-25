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
    console.error(
        "Neon pool error:",
        error.message
    );
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

const INITIAL_SUPPLY =
    ethers.parseUnits(
        "1000000",
        18
    );

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
    console.error(
        "SAVE TRANSACTION FAILED: transaction not found:",
        txHash
    );
    return null;
}

    const receipt =
        await provider.getTransactionReceipt(
            txHash
        );

    if (!receipt) {
    console.error(
        "SAVE TRANSACTION FAILED: receipt not found:",
        txHash
    );
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
console.log(
    "Transaction saved to Neon:",
    transaction.hash,
    `block=${receipt.blockNumber}`
);
    // =================================
    // Сохраняем raw-транзакцию
    // =================================

    if (
        rawTransaction &&
        typeof rawTransaction === "string" &&
        rawTransaction.length > 2
    ) {
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
// СОХРАНЕНИЕ GAS-БАЛАНСА И NONCE
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
            normalized,
            "latest"
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

    await saveAccount(
        provider,
        transaction.from
    );

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

    if (
        transactionTo !== token
    ) {
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
//
// ВАЖНО:
//
// Здесь БОЛЬШЕ НЕТ:
//
// - отправки 1 GAS владельцу
// - отправки 100 000 GLB владельцу
//
// Иначе при каждом рестарте состояние
// начинало бы изменяться.
//
// Контракт всё равно создаётся заново,
// но затем его состояние восстанавливается
// непосредственно из Neon.
//

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

    const deploymentTransaction =
        token.deploymentTransaction();

    if (deploymentTransaction) {
        await deploymentTransaction.wait();
    }

    await token.waitForDeployment();

    const tokenAddress =
        await token.getAddress();

    console.log(
        "Contract address:",
        tokenAddress
    );

    if (deploymentTransaction) {
        await saveTransaction(
            provider,
            deploymentTransaction.hash
        );
    }

    await saveChainState(
        tokenAddress
    );

    console.log(
        "Base GLB contract created."
    );

    return tokenAddress;
}

// =================================
// ВОССТАНОВЛЕНИЕ GAS-БАЛАНСОВ И NONCE
// =================================

async function restoreAccounts() {
    const provider =
        getProvider();

    console.log(
        "Restoring accounts from Neon..."
    );

    const result =
        await db.query(
            `
            SELECT
                address,
                balance,
                nonce
            FROM accounts
            ORDER BY address ASC
            `
        );

    console.log(
        `Found ${result.rows.length} saved account(s).`
    );

    for (
        const row
        of result.rows
    ) {
        try {
            const address =
                ethers.getAddress(
                    row.address
                );

            const balance =
                BigInt(
                    row.balance
                );

            const nonce =
                Number(
                    row.nonce
                );

            await provider.send(
                "hardhat_setBalance",
                [
                    address,
                    "0x" +
                        balance.toString(16)
                ]
            );

            const currentNonce =
                await provider.getTransactionCount(
                    address,
                    "latest"
                );

            if (
                currentNonce <
                nonce
            ) {
                await provider.send(
                    "hardhat_setNonce",
                    [
                        address,
                        "0x" +
                            nonce.toString(16)
                    ]
                );
            }

            console.log(
                `Account restored: ${address} | balance=${balance} | nonce=${nonce}`
            );
        } catch (error) {
            console.error(
                `Failed to restore account ${row.address}:`,
                error.message
            );
        }
    }

    console.log(
        "Account restoration completed."
    );
}

// =================================
// ВОССТАНОВЛЕНИЕ GLB STORAGE
// =================================
//
// GlebusToken:
//
// slot 0 = name
// slot 1 = symbol
// slot 2 = decimals
// slot 3 = totalSupply
// slot 4 = balanceOf mapping
//
// Для mapping:
//
// keccak256(
//     abi.encode(walletAddress, 4)
// )
//
// Hardhat позволяет напрямую записать
// значение в storage контракта.
//

async function restoreTokenBalances(
    tokenAddress
) {
    const provider =
        getProvider();

    console.log(
        "Restoring GLB balances from Neon..."
    );

    const result =
        await db.query(
            `
            SELECT
                wallet_address,
                balance
            FROM token_balances
            WHERE LOWER(token_address) = LOWER($1)
            ORDER BY wallet_address ASC
            `,
            [tokenAddress]
        );

    console.log(
        `Found ${result.rows.length} saved GLB balance(s).`
    );

    const BALANCE_MAPPING_SLOT = 4n;

    let restoredTotal = 0n;

    for (
        const row
        of result.rows
    ) {
        try {
            const wallet =
                ethers.getAddress(
                    row.wallet_address
                );

            const balance =
                BigInt(
                    row.balance
                );

            const storageSlot =
                ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        [
                            "address",
                            "uint256"
                        ],
                        [
                            wallet,
                            BALANCE_MAPPING_SLOT
                        ]
                    )
                );

            const storageValue =
                ethers.zeroPadValue(
                    ethers.toBeHex(
                        balance
                    ),
                    32
                );

            await provider.send(
                "hardhat_setStorageAt",
                [
                    tokenAddress,
                    storageSlot,
                    storageValue
                ]
            );

            restoredTotal += balance;

            console.log(
                `GLB restored: ${wallet} = ${ethers.formatUnits(balance, 18)} GLB`
            );

        } catch (error) {
            console.error(
                `Failed to restore GLB balance ${row.wallet_address}:`,
                error.message
            );
        }
    }

    // =================================
    // Восстанавливаем остаток GLB
    // на Hardhat account #0
    // =================================

    const signer =
        await provider.getSigner(0);

    const signerAddress =
        await signer.getAddress();

    const remaining =
        INITIAL_SUPPLY -
        restoredTotal;

    if (remaining > 0n) {

        const ownerSlot =
            ethers.keccak256(
                ethers.concat([
                    ethers.zeroPadValue(
                        signerAddress,
                        32
                    ),
                    ethers.zeroPadValue(
                        "0x04",
                        32
                    )
                ])
            );

        await provider.send(
            "hardhat_setStorageAt",
            [
                tokenAddress,
                ownerSlot,
                ethers.zeroPadValue(
                    ethers.toBeHex(
                        remaining
                    ),
                    32
                )
            ]
        );

        console.log(
            `GLB remaining assigned to Hardhat account #0: ${ethers.formatUnits(remaining, 18)} GLB`
        );

    } else if (remaining < 0n) {

        console.log(
            "WARNING: saved GLB balances exceed totalSupply."
        );
    }

    console.log(
        "GLB balance restoration completed."
    );
}

// =================================
// ПРОВЕРКА ВОССТАНОВЛЕННОГО СОСТОЯНИЯ
// =================================

async function verifyRestoredState(
    tokenAddress
) {
    const provider =
        getProvider();

    const artifact =
        getArtifact();

    const token =
        new ethers.Contract(
            tokenAddress,
            artifact.abi,
            provider
        );

    console.log(
        "Verifying restored state..."
    );

    const ownerBalance =
        await token.balanceOf(
            OWNER_ADDRESS
        );

    const ownerGas =
        await provider.getBalance(
            OWNER_ADDRESS
        );

    const ownerNonce =
        await provider.getTransactionCount(
            OWNER_ADDRESS,
            "latest"
        );

    console.log(
        "Owner GAS:",
        ethers.formatEther(
            ownerGas
        )
    );

    console.log(
        "Owner GLB:",
        ethers.formatUnits(
            ownerBalance,
            18
        )
    );

    console.log(
        "Owner nonce:",
        ownerNonce
    );

    console.log(
        "State verification completed."
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
    if (
        await handleExplorerRequest(req, res)
    ) {
        return;
    }

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

                                            await sleep(
                                                100
                                            );
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

                                        // =================================
                                        // OWNER NONCE
                                        // =================================

                                        const tx =
                                            await provider.getTransaction(
                                                hash
                                            );

                                        if (
                                            tx &&
                                            tx.from &&
                                            tx.from.toLowerCase() ===
                                                OWNER_ADDRESS.toLowerCase()
                                        ) {
                                            await saveAccount(
                                                provider,
                                                OWNER_ADDRESS
                                            );

                                            const newNonce =
                                                await provider.getTransactionCount(
                                                    OWNER_ADDRESS,
                                                    "latest"
                                                );

                                            console.log(
                                                `Owner nonce saved after transaction: ${newNonce}`
                                            );
                                        }

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
                        res.writeHead(
                            502
                        );
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

async function handleExplorerRequest(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return true;
    }

    if (
        req.method !== "GET" ||
        !req.url.startsWith("/api/explorer")
    ) {
        return false;
    }

    try {
        // Текущий блок локального Hardhat
        let latestBlock = 0;

        try {
            const provider = getProvider();
            latestBlock = await provider.getBlockNumber();
        } catch (error) {
            console.error(
                "Explorer latest block error:",
                error
            );
        }

        // Получаем адрес GLB
        let tokenAddress = null;

        try {
            const chainState = await db.query(`
                SELECT token_address
                FROM chain_state
                LIMIT 1
            `);

            if (chainState.rows.length > 0) {
                tokenAddress =
                    chainState.rows[0].token_address;
            }
        } catch (error) {
            console.error(
                "Explorer token address error:",
                error
            );
        }

        // Получаем сохранённые транзакции из Neon.
        // Историю НЕ ограничиваем текущим Hardhat-блоком,
        // потому что Neon хранит историю прошлых запусков.
        const result = await db.query(`
            SELECT
                hash,
                block_number,
                from_address,
                to_address,
                value,
                data
            FROM transactions
            ORDER BY block_number DESC
            LIMIT 50
        `);

        const iface = new ethers.Interface([
            "function transfer(address to, uint256 amount)"
        ]);

        const transactions = result.rows.map((tx) => {
            let tokenAmount = null;
            let tokenRecipient = null;
            let tokenSymbol = null;
            let isTokenTransfer = false;

            try {
                if (
                    tx.data &&
                    tx.data.startsWith("0xa9059cbb")
                ) {
                    const decoded =
                        iface.decodeFunctionData(
                            "transfer",
                            tx.data
                        );

                    tokenRecipient = decoded[0];
                    tokenAmount = decoded[1].toString();
                    tokenSymbol = "GLB";
                    isTokenTransfer = true;
                }
            } catch (error) {
                console.error(
                    "Explorer token decode error:",
                    error
                );
            }

            return {
                hash: tx.hash,
                blockNumber: tx.block_number,
                from: tx.from_address,
                to: tx.to_address,
                value: tx.value,
                tokenAmount: tokenAmount,
                tokenRecipient: tokenRecipient,
                tokenSymbol: tokenSymbol,
                isTokenTransfer: isTokenTransfer,
                input: tx.data
            };
        });

        // Собираем блоки из сохранённой истории
        const blocksMap = new Map();

        for (const tx of transactions) {
            const number =
                Number(tx.blockNumber);

            if (!blocksMap.has(number)) {
                blocksMap.set(
                    number,
                    {
                        number: number,
                        transactions: []
                    }
                );
            }

            blocksMap
                .get(number)
                .transactions
                .push(tx);
        }

        // Получаем сохранённые блоки из Neon
        try {
            const savedBlocks = await db.query(`
                SELECT
                    number,
                    hash,
                    parent_hash,
                    timestamp,
                    data
                FROM blocks
                ORDER BY number DESC
                LIMIT 50
            `);

            for (const block of savedBlocks.rows) {
                const number =
                    Number(block.number);

                if (!blocksMap.has(number)) {
                    blocksMap.set(
                        number,
                        {
                            number: number,
                            hash: block.hash,
                            parentHash: block.parent_hash,
                            timestamp: block.timestamp,
                            data: block.data,
                            transactions: []
                        }
                    );
                } else {
                    const existing =
                        blocksMap.get(number);

                    existing.hash =
                        block.hash;

                    existing.parentHash =
                        block.parent_hash;

                    existing.timestamp =
                        block.timestamp;

                    existing.data =
                        block.data;
                }
            }
        } catch (error) {
            console.error(
                "Explorer blocks error:",
                error
            );
        }

        const blocks =
            Array.from(blocksMap.values())
                .sort(
                    (a, b) =>
                        Number(b.number) -
                        Number(a.number)
                );

        // Если текущего локального блока ещё нет
        // в сохранённой истории — добавляем его.
        if (
            latestBlock > 0 &&
            !blocksMap.has(latestBlock)
        ) {
            blocks.unshift({
                number: latestBlock,
                transactions: []
            });
        }

        res.writeHead(200, {
            "Content-Type":
                "application/json; charset=utf-8"
        });

        res.end(
            JSON.stringify({
                latestBlock: latestBlock,
                tokenAddress: tokenAddress,
                transactions: transactions,
                blocks: blocks
            })
        );

        return true;

    } catch (error) {
        console.error(
            "Explorer Neon API error:",
            error
        );

        res.writeHead(500, {
            "Content-Type":
                "application/json; charset=utf-8"
        });

        res.end(
            JSON.stringify({
                error:
                    "Не удалось получить историю из Neon"
            })
        );

        return true;
    }
}

async function start() {

    console.log(
        "Starting GlebusNet..."
    );

    // =================================
    // NEON
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

        console.error(
            error
        );

        process.exit(1);
    }

    // =================================
    // HARDHAT
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
    // ЖДЁМ HARDHAT RPC
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

            await sleep(
                1000
            );
        }
    }

    if (!rpcReady) {
        throw new Error(
            "Hardhat RPC did not start"
        );
    }

    // =================================
    // СОЗДАЁМ КОНТРАКТ
    // =================================

    try {
        const tokenAddress =
            await createBaseState();

        // =================================
        // ВОССТАНАВЛИВАЕМ GAS + NONCE
        // =================================

        await restoreAccounts();

        // =================================
        // ВОССТАНАВЛИВАЕМ GLB
        // =================================

        await restoreTokenBalances(
            tokenAddress
        );

        // =================================
        // ПРОВЕРКА
        // =================================

        await verifyRestoredState(
            tokenAddress
        );

        // =================================
        // СОХРАНЯЕМ СОСТОЯНИЕ
        // =================================

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

        console.error(
            error
        );

        process.exit(1);
    }

    // =================================
    // ПУБЛИЧНЫЙ RPC
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