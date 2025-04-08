import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import dotenv from 'dotenv';
import { NewMessage } from 'telegram/events';
import fs from 'fs';

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const groupMapEnv = process.env.GROUP_MAP || '';

const groupMap: Record<string, string> = groupMapEnv.split(',').reduce((acc, mapping) => {
    const [source, target] = mapping.split(':').map((id) => id.trim());
    if (!source.startsWith("-100")) {
        acc[`${source.slice(1)}`] = target;
    } else {
        acc[`${source.slice(4)}`] = target;
    }
    return acc;
}, {} as Record<string, string>);


const sessionFile = './session.txt';
let stringSession: StringSession;
if (fs.existsSync(sessionFile)) {
    const savedSession = fs.readFileSync(sessionFile, 'utf8');
    stringSession = new StringSession(savedSession);
    console.log('📚 Usando string de sessão salva');
} else {
    stringSession = new StringSession('');
    console.log('🔑 Realizando autenticação...');
}

const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

client.addEventHandler(async (event) => {
    const message = event.message;


    const peerIdJson = message.peerId.toJSON();

    if ('channelId' in peerIdJson) {

        const chatId = peerIdJson.channelId.valueOf();

        if (!chatId) {
            console.error("chatId é indefinido");
            return;
        }

        if (!message.message) {
            console.error("A mensagem não contém texto");
            return;
        }

        if (groupMap[chatId]) {
            const targetChatId = groupMap[chatId];
            const peerUser = message.fromId?.toJSON();
            const userName = ['', ''];
            if (peerUser && 'userId' in peerUser) {
                const user = (await client.getEntity(peerUser.userId.valueOf()));
                if ('firstName' in user) {
                    userName[0] = user.firstName ? user.firstName : ''
                }
                if ('lastName' in user) {
                    userName[1] = user.lastName ? user.lastName : ''
                }
            }

            try {
                await client.sendMessage(targetChatId, {
                    message: `${userName[0]} ${userName[1]}:\n${message.message || ''}`
                });
            } catch (error) {
                console.error(error);
            }
        }
    }




}, new NewMessage({}));

async function main() {
    console.log("✅ Entrando no Telegram...");

    if (!fs.existsSync(sessionFile)) {
        await client.start({
            phoneNumber: async () => {
                const phone = await prompt("📱 Digite seu número de telefone: ");
                return phone;
            },
            password: async () => {
                const password = await prompt("🔐 Digite a senha de 2FA: ");
                return password;
            },
            phoneCode: async () => {
                const code = await prompt("📲 Digite o código enviado: ");
                return code;
            },
            onError: (err) => {
                console.error("Erro ao conectar:", err);
            },
        });

        const sessionString = client.session.save() as unknown as string;
        fs.writeFileSync(sessionFile, sessionString, 'utf8');
        console.log('✅ String de sessão salva com sucesso!');
    } else {
        await client.connect();
    }

    console.log("✅ Bot conectado com sucesso!");

    console.log("Bot is running...");
}

main().catch((error) => {
    console.error("Erro no bot:", error);
});

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        readline.question(question, (answer: string) => {
            readline.close();
            resolve(answer);
        });
    });
}
