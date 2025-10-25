import { useState } from "react";
import { useSolana } from "@/components/solana/use-solana.tsx";
import {
  createTransaction,
  signAndSendTransactionMessageWithSigners,
  getExplorerLink,
  getBase58Decoder,
  type Address
} from "gill";
import { getAddMemoInstruction } from "gill/programs";
import { useWalletUiSigner } from "@wallet-ui/react";
import {type UiWalletAccount} from '@wallet-ui/react'

export default function SignTx() {
  const solana = useSolana();
  const account = solana.account as UiWalletAccount;
  const address = account?.address as Address;
  const signer = useWalletUiSigner({account});
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signMessage = async () => {
    if (!signer || !address) return;

    setLoading(true);
    try {
      const rpc = solana.client.rpc;
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const memoIx = getAddMemoInstruction({
        memo: "Leo the choccy milk princess"
      });

      const transaction = createTransaction({
        version: 'legacy',
        feePayer: signer,
        instructions: [memoIx],
        latestBlockhash: latestBlockhash,
      });

      const txSignature = await signAndSendTransactionMessageWithSigners(transaction);
      const signatureString = getBase58Decoder().decode(txSignature);

      setSignature(signatureString);
      console.log(getExplorerLink({ transaction: signatureString }));
    } catch (error) {
      console.error("Error signing message:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2>{address ?? "Not connected"}</h2>
      {address && (
        <button onClick={signMessage} disabled={loading}>
          {loading ? "Signing..." : "Sign Message"}
        </button>
      )}
      {signature && <p>Signature: {signature}</p>}
    </>
  );
}
