import * as Discord from "discord.js";
import { getArtifact, Multipass, getContract } from "../sdk/dist";
import { SupportedChains } from "rankify-js";
import { ethers } from "ethers";
import { MultipassDiamond } from "rankify-contracts/types";
import axios from "axios";

if (!process.env.DISCORD_REGISTRAR_PRIVATE_KEY) throw new Error("no DISCORD_REGISTRAR_PRIVATE_KEY provided");
if (!process.env.RPC_URL) throw new Error("no RPC_URL provided");
if (!process.env.ARB_RPC_URL) throw new Error("no ARB_RPC_URL provided");

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const ArbProvider = new ethers.providers.JsonRpcProvider(process.env.ARB_RPC_URL);
// const multisigAddresses = ["0x8F29e5660d967c9e7308BE3697b9C7D5Ebd853aE", "0x2EecE69698D467b77D1374372dfe5B89b70DD259"];

const safeAddress = "0x8F29e5660d967c9e7308BE3697b9C7D5Ebd853aE";
const apiUrl = `https://safe-transaction-arbitrum.safe.global/api/v1/safes/${safeAddress}/incoming-transfers/?limit=1`;

let lastTransactionHash: string | null = null;

const checkForNewTransactions = async () => {
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const transactions = response.data.results;
    if (transactions.length > 0) {
      const latestTransaction = transactions[0];
      if (latestTransaction.transactionHash !== lastTransactionHash) {
        lastTransactionHash = latestTransaction.transactionHash;
        console.log(`New transaction detected: ${latestTransaction.transactionHash}`);
        console.log(`Sender: ${latestTransaction.from}`);
        console.log(`Value: ${ethers.utils.formatEther(latestTransaction.value)} ETH`);

        // Call your function here
        handleNewTransaction(latestTransaction);
      }
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
  }
};

const handleNewTransaction = async (transaction: any) => {
  // Implement your logic to handle the new transaction here
  console.log("Handling new transaction:", transaction);
  const { transactionHash } = transaction;
  const { from } = await ArbProvider.getTransaction(transactionHash);

  const query = multipassJs.formQueryByAddress({
    address: from,
    domainName: "discord.com",
  });

  const multipass = getContract(chainName, "Multipass", provider);
  const response = await multipass["resolveRecord"](query);
  console.log(JSON.stringify(response, null, 2));
  if (response[0]) {
    // Send a message to the Discord webhook
    const webhookUrl = "https://discord.com/api/webhooks/1303670180034908211/Vpn9v_jH019CmkSjeJwGs-qdEdBN4hQJjGDfLQrEYsWNtd2dzHcJUxyb5x8Tx-jKpNXJ";
    const message = {
      content: `New Early Bird Eligible user: ${ethers.utils.parseBytes32String(response[1].name)}`,
    };

    try {
      await axios.post(webhookUrl, message, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      console.log("Message sent to Discord webhook");
    } catch (error) {
      console.error("Error sending message to Discord webhook:", error);
    }
  }
};

// Poll the API every minute
setInterval(checkForNewTransactions, 10000);

console.log(`Polling for transactions sending ETH to ${safeAddress}...`);

if (!process.env.DISCORD_REGISTRAR_PRIVATE_KEY) throw new Error("no DISCORD_REGISTRAR_PRIVATE_KEY provided");
if (!process.env.RPC_URL) throw new Error("no RPC_URL provided");

// const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.DISCORD_REGISTRAR_PRIVATE_KEY, provider);

const DOMAIN_NAME = "discord.com";
function wait(ms: any) {
  var start = new Date().getTime();
  var end = start;
  while (end < start + ms) {
    end = new Date().getTime();
  }
}

const chainName = process.env.CHAIN_NAME as SupportedChains;

const multipassJs = new Multipass({
  chainName: chainName,
});
const myIntents = new Discord.IntentsBitField();

myIntents.add("GuildMessages", "DirectMessages", "Guilds", "MessageContent");
const client = new Discord.Client({
  intents: myIntents,
  partials: [Discord.Partials.Channel],
});

client.on("ready", () => {
  console.log(`Logged in as ${client?.user?.tag}!`);
  console.log(`Running provider as ${signer.address}`);
  client.user?.setPresence({
    status: "online", // You can set it to "online", "idle", "dnd", or "invisible"
    activities: [{ name: "with code", type: Discord.ActivityType.Playing }],
  });
});

const { address, abi } = getArtifact(chainName, "Multipass");
const multipass = new ethers.Contract(address, abi, signer) as any as MultipassDiamond;

const getMentionedIds = (msg: any) => {
  const mentionedIds: Array<any> = [];
  for (const [key, value] of msg.mentions.users) {
    console.log(`${key} goes ${value}`);
    mentionedIds.push(key);
  }
  return mentionedIds;
};
const signUp = async (msg: any) => {
  console.log("signing up flow..");
  const channel = msg.channel;
  const username = msg.author.username + "#" + msg.author.discriminator;

  const query = multipassJs.formQueryByUsernameAndId({
    username: username,
    id: msg.author.id,
    domainName: DOMAIN_NAME,
  });
  const response = await multipass["resolveRecord"](query);
  console.log(JSON.stringify(response, null, 2));
  const readGas = await multipass.estimateGas.resolveRecord(query);
  console.log("Gas estimation: ", readGas.toString());
  if (response[0]) {
    channel.send("you seem already to be registered: `" + response[1].wallet + "`");
  } else {
    const deadline = (await provider.getBlockNumber()) + 1000;
    console.log("getting registrar message..");
    const registrarMessage = multipassJs.getRegistrarMessage({
      username,
      id: msg.author.id,
      domainName: DOMAIN_NAME,
      validUntil: deadline,
    });
    console.log("signing..");
    multipassJs.signRegistrarMessage(registrarMessage, address, signer).then((signature: any) => {
      if (!process.env.WEB_URL) throw new Error("no WEB_URL provided ");

      const embed = new Discord.EmbedBuilder();
      embed.setURL(multipassJs.getDappURL(registrarMessage, signature, process.env.WEB_URL + `/dapps/multipass/signup`, getArtifact("anvil", "Multipass").address, DOMAIN_NAME));
      embed.setDescription("This will take you to multipass registry website").setTitle("Click to register");

      channel.send({ embeds: [embed] });
    });
  }
};

const getRecord = async (msg: any) => {
  const args = msg.content.split(" ");
  const mentionedIds = getMentionedIds(msg);
  if (mentionedIds.length > 1) {
    const query = multipassJs.formQueryById({
      id: mentionedIds[1],
      domainName: DOMAIN_NAME,
    });
    const response = await multipass.resolveRecord(query);
    msg.reply(response[1].wallet);
  } else if (ethers.utils.isAddress(args[2].toLowerCase())) {
    const query = multipassJs.formQueryByAddress({
      address: args[2],
      domainName: DOMAIN_NAME,
    });
    const response = await multipass.resolveRecord(query);
    msg.reply("<@" + ethers.utils.parseBytes32String(response[1].id) + ">");
  } else {
    msg.reply("Arguments required:\n\t get <@mention> \n\t get <address>");
  }
};
client.on("messageCreate", async (msg: any) => {
  if (msg.author.bot) return;
  console.log(msg.content.startsWith("ping"));
  const channel = msg.channel;
  if (channel.type == Discord.ChannelType.DM) {
    //Only DM API
    if (msg.content.startsWith(`signup`)) {
      signUp(msg);
    }
  } else {
    //Only public API
  }
  //DM OR Public API
  if (msg.content === "ping") {
    msg.reply("pong");
  }
  if (msg.content.startsWith(`<@${client?.user?.id}> get`)) {
    getRecord(msg);
  }
  if (msg.content.startsWith(`registrar address`)) {
    msg.reply(`${signer.address}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
