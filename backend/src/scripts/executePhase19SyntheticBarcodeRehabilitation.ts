import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-phase-19-synthetic-barcode-rehabilitation";

const authorization = {
  identities: [
    { id: "cmtk4sg0600z9ib1gt25xxhl2", sku: "SARIMA-P339", sarimaSourceProductId: "P339", expectedCurrentBarcode: "YSB-SARIMA-P339", verifiedBarcode: "4800092332852" },
    { id: "cmtk4sg0e00zdib1gwzoa19p1", sku: "SARIMA-P340", sarimaSourceProductId: "P340", expectedCurrentBarcode: "YSB-SARIMA-P340", verifiedBarcode: "4800092331909" },
    { id: "cmtk4sg0r00zhib1gdp5nhhjn", sku: "SARIMA-P341", sarimaSourceProductId: "P341", expectedCurrentBarcode: "YSB-SARIMA-P341", verifiedBarcode: "4800092116537" },
    { id: "cmtk4sg0y00zlib1gefat8q3s", sku: "SARIMA-P342", sarimaSourceProductId: "P342", expectedCurrentBarcode: "YSB-SARIMA-P342", verifiedBarcode: "4800010781076" },
    { id: "cmtk4sg220105ib1gcte2f61r", sku: "SARIMA-P347", sarimaSourceProductId: "P347", expectedCurrentBarcode: "YSB-SARIMA-P347", verifiedBarcode: "4800092551444" },
    { id: "cmtk4sg2a0109ib1gz7i71zzg", sku: "SARIMA-P348", sarimaSourceProductId: "P348", expectedCurrentBarcode: "YSB-SARIMA-P348", verifiedBarcode: "4800092551369" },
    { id: "cmtk4sg2i010dib1gd3hkh4c0", sku: "SARIMA-P349", sarimaSourceProductId: "P349", expectedCurrentBarcode: "YSB-SARIMA-P349", verifiedBarcode: "4800092550904" },
    { id: "cmtk4sg2p010hib1g8o5kgtz4", sku: "SARIMA-P350", sarimaSourceProductId: "P350", expectedCurrentBarcode: "YSB-SARIMA-P350", verifiedBarcode: "4800092553226" },
    { id: "cmtk4sg2x010lib1gxoiikb1v", sku: "SARIMA-P351", sarimaSourceProductId: "P351", expectedCurrentBarcode: "YSB-SARIMA-P351", verifiedBarcode: "4800010075878" },
    { id: "cmtk4sg3l010xib1g82bkgg82", sku: "SARIMA-P354", sarimaSourceProductId: "P354", expectedCurrentBarcode: "YSB-SARIMA-P354", verifiedBarcode: "4807770101540" },
    { id: "cmtk4sg3v0111ib1gj0o89qgh", sku: "SARIMA-P355", sarimaSourceProductId: "P355", expectedCurrentBarcode: "YSB-SARIMA-P355", verifiedBarcode: "4807770101557" },
    { id: "cmtk4sg430115ib1ge8z8ljfk", sku: "SARIMA-P356", sarimaSourceProductId: "P356", expectedCurrentBarcode: "YSB-SARIMA-P356", verifiedBarcode: "4800016077524" },
    { id: "cmtk4sg4b0119ib1givun6zi7", sku: "SARIMA-P357", sarimaSourceProductId: "P357", expectedCurrentBarcode: "YSB-SARIMA-P357", verifiedBarcode: "4800010042146" },
    { id: "cmtk4sg4v011hib1g60i3c9rp", sku: "SARIMA-P359", sarimaSourceProductId: "P359", expectedCurrentBarcode: "YSB-SARIMA-P359", verifiedBarcode: "4800092113338" },
    { id: "cmtk4sg5t011tib1g7tz23qf2", sku: "SARIMA-P362", sarimaSourceProductId: "P362", expectedCurrentBarcode: "YSB-SARIMA-P362", verifiedBarcode: "4800092116513" },
    { id: "cmtk4sg680121ib1gsnokt9r8", sku: "SARIMA-P365", sarimaSourceProductId: "P365", expectedCurrentBarcode: "YSB-SARIMA-P365", verifiedBarcode: "4800092115707" },
    { id: "cmtk4sg77012hib1gs4pj0qnt", sku: "SARIMA-P369", sarimaSourceProductId: "P369", expectedCurrentBarcode: "YSB-SARIMA-P369", verifiedBarcode: "4800016633782" },
    { id: "cmtk4sg7p012pib1goei3nu04", sku: "SARIMA-P372", sarimaSourceProductId: "P372", expectedCurrentBarcode: "YSB-SARIMA-P372", verifiedBarcode: "4800194115445" },
    { id: "cmtk4sg8p0135ib1gts0b5pb1", sku: "SARIMA-P376", sarimaSourceProductId: "P376", expectedCurrentBarcode: "YSB-SARIMA-P376", verifiedBarcode: "4800166142325" },
    { id: "cmtk4sge3015lib1g56u1hh6z", sku: "SARIMA-P399", sarimaSourceProductId: "P399", expectedCurrentBarcode: "YSB-SARIMA-P399", verifiedBarcode: "4800092551284" },
    { id: "cmtk4sgg8016hib1gcndkpvde", sku: "SARIMA-P407", sarimaSourceProductId: "P407", expectedCurrentBarcode: "YSB-SARIMA-P407", verifiedBarcode: "4800092332043" },
    { id: "cmtk4sgj7017lib1gkfql7h2c", sku: "SARIMA-P417", sarimaSourceProductId: "P417", expectedCurrentBarcode: "YSB-SARIMA-P417", verifiedBarcode: "4807770101533" },
    { id: "cmtk4sgjn017tib1gruuaytdi", sku: "SARIMA-P419", sarimaSourceProductId: "P419", expectedCurrentBarcode: "YSB-SARIMA-P419", verifiedBarcode: "4800010075861" },
    { id: "cmtk4sgkr0189ib1gqhj14lmm", sku: "SARIMA-P423", sarimaSourceProductId: "P423", expectedCurrentBarcode: "YSB-SARIMA-P423", verifiedBarcode: "4800016082917" },
    { id: "cmtk4sgn20195ib1gjml9k2t4", sku: "SARIMA-P432", sarimaSourceProductId: "P432", expectedCurrentBarcode: "YSB-SARIMA-P432", verifiedBarcode: "4800194105972" },
    { id: "cmtk4sgrl01apib1g4k1cz4e4", sku: "SARIMA-P447", sarimaSourceProductId: "P447", expectedCurrentBarcode: "YSB-SARIMA-P447", verifiedBarcode: "4800092551604" },
    { id: "cmtk4sgtr01btib1gtr1h4xif", sku: "SARIMA-P457", sarimaSourceProductId: "P457", expectedCurrentBarcode: "YSB-SARIMA-P457", verifiedBarcode: "750515017450" },
    { id: "cmtk4sgu901c1ib1gsvxe7m0f", sku: "SARIMA-P459", sarimaSourceProductId: "P459", expectedCurrentBarcode: "YSB-SARIMA-P459", verifiedBarcode: "4800092113253" },
    { id: "cmtk4sguo01c9ib1gytt0x0uk", sku: "SARIMA-P461", sarimaSourceProductId: "P461", expectedCurrentBarcode: "YSB-SARIMA-P461", verifiedBarcode: "4800016663505" },
    { id: "cmtk4scma0049ib1gq1twbop5", sku: "SARIMA-P042", sarimaSourceProductId: "P042", expectedCurrentBarcode: "YSB-SARIMA-P042", verifiedBarcode: "4806502359754" },
    { id: "cmtk4scoh004xib1gioe0pcxe", sku: "SARIMA-P048", sarimaSourceProductId: "P048", expectedCurrentBarcode: "YSB-SARIMA-P048", verifiedBarcode: "4801288820153" },
    { id: "cmtk4sef3009xib1g5ndtb9sz", sku: "SARIMA-P100", sarimaSourceProductId: "P100", expectedCurrentBarcode: "YSB-SARIMA-P100", verifiedBarcode: "4808680022482" },
    { id: "cmtk4seik00bhib1g2zfn7xzv", sku: "SARIMA-P115", sarimaSourceProductId: "P115", expectedCurrentBarcode: "YSB-SARIMA-P115", verifiedBarcode: "4808647020094" }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) throw new Error(`PHASE_19_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`);
  const result = await executeSyntheticBarcodeRehabilitation({ client: prisma as unknown as SyntheticBarcodeRehabilitationClient, authorization });
  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
