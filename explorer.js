<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>GlebusNet Explorer</title>

    <style>
        body {
            margin: 0;
            background: #0f172a;
            color: white;
            font-family: Arial, sans-serif;
        }

        .container {
            width: 92%;
            max-width: 1000px;
            margin: 0 auto;
            padding: 30px 0;
        }

        h1 {
            margin-bottom: 5px;
        }

        .subtitle {
            color: #94a3b8;
            margin-bottom: 30px;
        }

        .status {
            display: inline-block;
            padding: 8px 14px;
            border-radius: 20px;
            background: #14532d;
            color: #86efac;
            margin-bottom: 25px;
        }

        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .card {
            background: #1e293b;
            border-radius: 16px;
            padding: 20px;
        }

        .label {
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 8px;
        }

        .value {
            font-size: 22px;
            font-weight: bold;
            word-break: break-all;
        }

        .section {
            margin-top: 30px;
        }

        .section h2 {
            margin-bottom: 15px;
        }

        .block {
            background: #1e293b;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 10px;
        }

        .block-number {
            font-size: 18px;
            font-weight: bold;
        }

        .small {
            color: #94a3b8;
            font-size: 13px;
            margin-top: 6px;
            word-break: break-all;
        }

        .error {
            background: #450a0a;
            color: #fca5a5;
            padding: 15px;
            border-radius: 12px;
            margin-top: 20px;
        }

        button {
            margin-top: 20px;
            padding: 12px 18px;
            border: none;
            border-radius: 10px;
            background: #6366f1;
            color: white;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
        }

        button:hover {
            background: #4f46e5;
        }
    </style>
</head>

<body>

<div class="container">

    <h1>GlebusNet Explorer</h1>

    <div class="subtitle">
        Blockchain explorer for GlebusNet
    </div>

    <div id="status" class="status">
        Подключение...
    </div>

    <div class="cards">

        <div class="card">
            <div class="label">Сеть</div>
            <div class="value" id="network">—</div>
        </div>

        <div class="card">
            <div class="label">Chain ID</div>
            <div class="value" id="chainId">—</div>
        </div>

        <div class="card">
            <div class="label">Последний блок</div>
            <div class="value" id="blockNumber">—</div>
        </div>

        <div class="card">
            <div class="label">Токен</div>
            <div class="value">GLB</div>
        </div>

    </div>


    <div class="section">

        <h2>Информация о GLB</h2>

        <div class="card">

            <div class="label">
                Контракт
            </div>

            <div class="small">
                0x5FbDB2315678afecb367f032d93F642f64180aa3
            </div>

            <br>

            <div class="label">
                Название
            </div>

            <div class="value">
                Glebus
            </div>

            <br>

            <div class="label">
                Символ
            </div>

            <div class="value">
                GLB
            </div>

            <br>

            <div class="label">
                Общая эмиссия
            </div>

            <div class="value">
                1,000,000 GLB
            </div>

        </div>

    </div>


    <div class="section">

        <h2>Последние блоки</h2>

        <div id="blocks">
            Загрузка...
        </div>

        <button onclick="loadExplorer()">
            ↻ Обновить
        </button>

    </div>


    <div id="error"></div>

</div>


<script>

const RPC =
    "https://glebusnet.onrender.com";


async function rpc(method, params = []) {

    const response = await fetch(RPC, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            jsonrpc: "2.0",
            id: 1,
            method: method,
            params: params

        })

    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.result;
}


async function loadExplorer() {

    const status =
        document.getElementById("status");

    const error =
        document.getElementById("error");

    try {

        error.innerHTML = "";

        status.innerText =
            "Подключение к GlebusNet...";


        // Получаем Chain ID

        const chainId =
            await rpc("eth_chainId");

        const chainIdNumber =
            parseInt(chainId, 16);


        document.getElementById("network").innerText =
            "GlebusNet";

        document.getElementById("chainId").innerText =
            chainIdNumber;


        // Получаем последний блок

        const latestBlock =
            await rpc("eth_blockNumber");

        const latestNumber =
            parseInt(latestBlock, 16);


        document.getElementById("blockNumber").innerText =
            latestNumber;


        // Загружаем последние 10 блоков

        const blocksContainer =
            document.getElementById("blocks");

        blocksContainer.innerHTML = "";


        const start =
            Math.max(0, latestNumber - 9);


        for (
            let number = latestNumber;
            number >= start;
            number--
        ) {

            const hexNumber =
                "0x" + number.toString(16);


            const block =
                await rpc(
                    "eth_getBlockByNumber",
                    [hexNumber, true]
                );


            const div =
                document.createElement("div");

            div.className = "block";


            const timestamp =
                parseInt(
                    block.timestamp,
                    16
                );


            const date =
                new Date(
                    timestamp * 1000
                );


            div.innerHTML = `

                <div class="block-number">
                    Block #${number}
                </div>

                <div class="small">
                    Hash: ${block.hash}
                </div>

                <div class="small">
                    Транзакций: ${block.transactions.length}
                </div>

                <div class="small">
                    Время: ${date.toLocaleString()}
                </div>

            `;


            blocksContainer.appendChild(div);

        }


        status.innerText =
            "● GlebusNet работает";

    }

    catch (e) {

        console.error(e);

        status.innerText =
            "Ошибка подключения";

        error.innerHTML = `

            <div class="error">
                Не удалось подключиться к GlebusNet:<br><br>
                ${e.message}
            </div>

        `;

    }

}


loadExplorer();

</script>

</body>

</html>