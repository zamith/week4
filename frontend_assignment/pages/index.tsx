import detectEthereumProvider from "@metamask/detect-provider";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols";
import { providers, Contract, utils } from "ethers";
import Head from "next/head";
import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
} from "@mui/material";

import Form from "./components/Form";

export default function Home() {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const listenForGreeting = async () => {
      const provider = (await detectEthereumProvider()) as any;
      const ethers = new providers.Web3Provider(provider);

      const contract = new Contract(
        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        Greeter.abi,
        ethers
      );

      contract.on("NewGreeting", (greeting: string) => {
        setGreeting(utils.parseBytes32String(greeting));
      });
    };

    listenForGreeting().catch(console.error);
  }, []);

  async function greet() {
    const provider = (await detectEthereumProvider()) as any;

    await provider.request({ method: "eth_requestAccounts" });

    const ethersProvider = new providers.Web3Provider(provider);
    const signer = ethersProvider.getSigner();
    const message = await signer.signMessage(
      "Sign this message to create your identity!"
    );

    const identity = new ZkIdentity(Strategy.MESSAGE, message);
    const identityCommitment = identity.genIdentityCommitment();
    const identityCommitments = await (
      await fetch("./identityCommitments.json")
    ).json();

    const merkleProof = generateMerkleProof(
      20,
      BigInt(0),
      identityCommitments,
      identityCommitment
    );

    const greeting = "Hello world";

    const witness = Semaphore.genWitness(
      identity.getTrapdoor(),
      identity.getNullifier(),
      merkleProof,
      merkleProof.root,
      greeting
    );

    const { proof, publicSignals } = await Semaphore.genProof(
      witness,
      "./semaphore.wasm",
      "./semaphore_final.zkey"
    );
    const solidityProof = Semaphore.packToSolidityProof(proof);

    const response = await fetch("/api/greet", {
      method: "POST",
      body: JSON.stringify({
        greeting,
        nullifierHash: publicSignals.nullifierHash,
        solidityProof: solidityProof,
      }),
    });

    if (response.status === 500) {
      const errorMessage = await response.text();
      console.log(errorMessage);
    }
  }

  return (
    <div>
      <Head>
        <title>Formy</title>
        <meta
          name="description"
          content="A simple Next.js/Hardhat privacy application with Semaphore."
        />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
        />
      </Head>

      <Container component="main" maxWidth="sm" sx={{ my: 4 }}>
        <Typography variant="h2" component="h1">
          Formy
        </Typography>

        <Form onSubmit={(data) => console.log(data)} />

        <Card sx={{ mt: 6, minWidth: 275 }}>
          <CardContent>
            {greeting && (
              <div>
                <Typography
                  sx={{ fontSize: 14 }}
                  color="text.secondary"
                  gutterBottom
                >
                  Your Greeting
                </Typography>

                <Typography>{greeting}</Typography>
              </div>
            )}

            {!greeting && <Typography>Greet your friends!</Typography>}
          </CardContent>

          {!greeting && (
            <CardActions>
              <Button size="small" onClick={greet}>
                Greet
              </Button>
            </CardActions>
          )}
        </Card>
      </Container>
    </div>
  );
}
