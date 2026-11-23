"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  CreditCard,
  Download,
  Globe2,
  MoreHorizontal,
  Pause,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dialogPanelClass } from "@/components/ui/dialog";
import { GlassCard, SectionCard } from "@/components/platform/glass-card";
import { EmptyState, PageHeader, StatBlock } from "@/components/platform/primitives";
import { EstimatedChip, StatusChip } from "@/components/platform/status-chip";
import { NetworkBadges } from "@/components/platform/network-badges";
import { MonoValue } from "@/components/platform/mono-value";
import { UsageBar, UsageRing } from "@/components/platform/usage";
import { EsimCard } from "@/components/platform/esim-card";
import { PermissionMatrix } from "@/components/platform/permission-matrix";
import { ConfirmDialog, ReasonDialog } from "@/components/platform/confirm-dialog";
import { FpsMeter } from "@/components/platform/motion/fps-meter";
import { ThemeToggle } from "@/components/platform/theme-toggle";
import { Reveal } from "@/components/platform/motion/reveal";
import {
  CountryBar,
  MonthlyBarChart,
  PlansSoldChart,
  RevenueProfitChart,
  StatusDonut,
  TopEsimsBar,
  TransactionsChart,
  UsageAreaChart,
} from "@/components/platform/charts/charts";
import {
  esimStatus,
  installStatus,
  ORDER_STATUS,
  PLAN_STATE,
  type EsimStatus,
  type InstallStatus,
} from "@/lib/platform/status";
import { RESELLER_ENVELOPE, RESELLER_MATRIX, type Grants } from "@/lib/platform/permission-matrix";
import { cn } from "@/lib/utils";
import { DsSection, SubLabel, type Theme } from "./ds-kit";
import dynamic from "next/dynamic";

// Live graphics are client only: they need WebGL, and country names come from
// the browser's Intl data (which differs from the server's).
const LiveGraphicsSections = dynamic(() => import("./ds-live").then((m) => m.LiveGraphicsSections), {
  ssr: false,
  loading: () => <div className="h-[1600px]" aria-hidden="true" />,
});
import * as S from "./sample-data";

const NAV = [
  ["tokens", "Colour"],
  ["type", "Type"],
  ["surfaces", "Surfaces"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["status", "Status"],
  ["numbers", "Numbers"],
  ["table", "Table"],
  ["overlays", "Overlays"],
  ["charts", "Charts"],
  ["esim-card", "eSIM card"],
  ["matrix", "Permissions"],
  ["hero", "Sign-in"],
  ["motion", "Motion"],
] as const;

export function DesignSystemClient() {
  return (
    <div className="min-h-dvh">
      <header className="glass-pop sticky top-0 z-40 !rounded-none !border-x-0 !border-t-0">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-8">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[image:var(--gradient-signature)] text-on-solid shadow-[0_0_20px_var(--primary-glow)]">
            <Globe2 className="size-4" strokeWidth={1.5} />
          </span>
          <span className="hidden font-semibold sm:inline">Design system</span>
          <nav aria-label="Sections" className="ml-4 hidden min-w-0 flex-1 gap-1 overflow-x-auto lg:flex">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-3 py-1.5 text-small text-fg-2 transition-colors hover:bg-surface-3/60 hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <FpsMeter />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-16 px-4 pb-24 pt-10 sm:px-8">
        <Reveal>
          <PageHeader
            title="eSIM platform design system"
            description="The visual reference for every page (spec section 7). Each section shows dark, the primary design, next to light. Live graphics pause when off screen; add ?static=1 to see the fallbacks."
            actions={
              <Button variant="secondary" asChild>
                <a href="?static=1">
                  <Pause strokeWidth={1.5} /> Static graphics
                </a>
              </Button>
            }
          />
        </Reveal>

        <TokensSection />
        <TypeSection />
        <SurfacesSection />
        <ButtonsSection />
        <FormsSection />
        <StatusSection />
        <NumbersSection />
        <TableSection />
        <OverlaysSection />
        <ChartsSection />
        <EsimCardSection />
        <MatrixSection />
        <LiveGraphicsSections />
        <MotionSection />
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ tokens --

const TOKENS: { name: string; role: string }[] = [
  { name: "bg", role: "App background" },
  { name: "surface-1", role: "Base panels" },
  { name: "surface-2", role: "Raised panels" },
  { name: "surface-3", role: "Highest, hover" },
  { name: "text", role: "Primary text" },
  { name: "text-2", role: "Secondary text" },
  { name: "text-3", role: "Tertiary" },
  { name: "primary", role: "Azure: action" },
  { name: "accent", role: "Emerald: alive" },
  { name: "warning", role: "Warning, estimated" },
  { name: "danger", role: "Blocked, error" },
  { name: "neutral", role: "Ended, inactive" },
];

function TokensSection() {
  return (
    <DsSection id="tokens" title="Colour tokens" description="Semantic tokens only; no hex values in components. Azure is the action colour, Emerald means alive and healthy; warning and danger are for status only.">
      {(theme) => (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {TOKENS.map((t) => (
              <Swatch key={t.name} name={t.name} role={t.role} theme={theme} />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <SubLabel>Signature gradient (135°), glows and glass</SubLabel>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-14 rounded-control bg-[image:var(--gradient-signature)] shadow-[0_0_32px_-6px_var(--primary-glow)]" />
              <div className="h-14 rounded-control border border-border" style={{ background: "radial-gradient(circle at 50% 120%, var(--primary-glow), transparent 70%), radial-gradient(circle at 50% -20%, var(--accent-glow), transparent 70%)" }} />
              <div className="glass-card h-14 !rounded-control" />
            </div>
          </div>
        </div>
      )}
    </DsSection>
  );
}

function Swatch({ name, role }: { name: string; role: string; theme: Theme }) {
  const [value, setValue] = useState("");
  return (
    <div className="min-w-0">
      <div
        ref={(el) => {
          if (el && !value) setValue(getComputedStyle(el).getPropertyValue(`--${name}`).trim().toUpperCase());
        }}
        className="h-14 rounded-control border border-border shadow-[inset_0_1px_0_var(--highlight)]"
        style={{ background: `var(--${name})` }}
      />
      <p className="mt-2 font-mono text-small text-fg">--{name}</p>
      <p className="truncate text-small text-fg-3">
        {role} · <span className="font-mono">{value}</span>
      </p>
    </div>
  );
}

// -------------------------------------------------------------------- type --

function TypeSection() {
  return (
    <DsSection id="type" title="Typography" description="Geist Sans for the interface, Geist Mono for ICCIDs, IDs and codes. Tabular figures wherever numbers align. Sentence case, no all-caps labels.">
      {() => (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-display font-semibold">€12,480.50</p>
            <p className="text-small text-fg-3">Display 40/44 · hero numbers</p>
          </div>
          <div>
            <p className="text-title font-semibold">Page title, tight tracking</p>
            <p className="text-small text-fg-3">Title 28/34 semibold −0.02em</p>
          </div>
          <div>
            <p className="text-section font-semibold">Section title</p>
            <p className="text-small text-fg-3">Section 18/26 semibold</p>
          </div>
          <div>
            <p className="text-body">Body text explains things plainly. A plan&apos;s real cost depends on the network the phone uses, so plans show a price range plus a typical price.</p>
            <p className="text-small text-fg-3">Body 14/22</p>
          </div>
          <div>
            <p className="text-small text-fg-2">Small text for labels and hints.</p>
            <p className="text-small text-fg-3">Small 12/18</p>
          </div>
          <div className="glass-card grid grid-cols-2 gap-4 p-4">
            <div>
              <p className="text-small text-fg-3">Geist Mono</p>
              <p className="font-mono tabular">8937 2040 1615 2290 417</p>
              <p className="font-mono text-small text-fg-2">LPA:1$smdp.example.net$K2-4X7P-9QT</p>
            </div>
            <div>
              <p className="text-small text-fg-3">Tabular figures</p>
              <p className="tabular">€1,111.11</p>
              <p className="tabular">€8,888.88</p>
            </div>
          </div>
        </div>
      )}
    </DsSection>
  );
}

// ---------------------------------------------------------------- surfaces --

function SurfacesSection() {
  return (
    <DsSection id="surfaces" title="Surfaces, light and depth" description="Glass cards with a thin border and a 1px top highlight on soft ambient light. Only interactive cards glow, on hover and focus. Radii: shell 24, card 16, control 12.">
      {() => (
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassCard>
            <p className="text-section font-semibold">Glass card</p>
            <p className="mt-1 text-body text-fg-2">Static content. No hover effect.</p>
          </GlassCard>
          <GlassCard interactive tabIndex={0}>
            <p className="text-section font-semibold">Interactive card</p>
            <p className="mt-1 text-body text-fg-2">Hover or focus: a faint glow and a light that follows the cursor.</p>
          </GlassCard>
          <div className="flex flex-col gap-2 rounded-card bg-surface-1 p-4">
            <p className="text-small text-fg-3">Surface steps</p>
            <div className="flex gap-2">
              {["surface-1", "surface-2", "surface-3"].map((s) => (
                <div key={s} className="h-12 flex-1 rounded-control border border-border" style={{ background: `var(--${s})` }} />
              ))}
            </div>
          </div>
          <div className="glass-card flex flex-col gap-3 p-4" aria-label="Loading example">
            <p className="text-small text-fg-3">Loading: skeletons with a slow shimmer</p>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-28 rounded-control" />
          </div>
          <SectionCard
            title="Section card"
            description="Title, description and actions; actions wrap under the title on phones."
            actions={<Button size="sm" variant="secondary">Action</Button>}
            className="sm:col-span-2"
          >
            <EmptyState illustration="sim" title="No eSIMs yet" description="Sell your first eSIM to see it here." action={<Button><Plus strokeWidth={1.5} /> Sell eSIM</Button>} />
          </SectionCard>
        </div>
      )}
    </DsSection>
  );
}

// ----------------------------------------------------------------- buttons --

function ButtonsSection() {
  return (
    <DsSection id="buttons" title="Buttons" description="Primary: Azure gradient, 1px top highlight and light border, Geist 500 at 15px. Hover: a soft outer glow fades in and a light follows the cursor; press: 0.98 in 120 ms; focus: a 2px Azure ring with a soft glow. Secondary is glass; its border rises from 10% to 18% on hover. Destructive only for destructive actions.">
      {() => (
        <div className="flex flex-col gap-7">
          <div>
            <SubLabel>Variants</SubLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button arrow>Sell eSIM</Button>
              <Button variant="secondary">Request top-up</Button>
              <Button variant="outline">Export CSV</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Suspend eSIM</Button>
              <Button variant="link">View order</Button>
            </div>
          </div>
          <div>
            <SubLabel>Sizes: 36, 44, 52 and icon buttons</SubLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Add plan</Button>
              <Button size="md"><Download strokeWidth={1.5} /> Download QR</Button>
              <Button size="lg" arrow>Continue</Button>
              <Button size="sm" variant="secondary"><RefreshCw strokeWidth={1.5} /> Sync now</Button>
              <Tooltip content="More actions">
                <Button size="icon" variant="secondary" aria-label="More actions"><MoreHorizontal strokeWidth={1.5} /></Button>
              </Tooltip>
              <Button size="icon-sm" variant="ghost" aria-label="Delete"><Trash2 strokeWidth={1.5} /></Button>
            </div>
          </div>
          <div>
            <SubLabel>States: hover, focus and disabled (shown statically)</SubLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="[--btn-hover:var(--btn-glow)] [--glow-opacity:1] [--glow-x:35%] [--glow-y:30%]" tabIndex={-1}>Hover</Button>
              <Button className="[--btn-ring:0_0_0_2px_var(--primary),0_0_0_6px_color-mix(in_oklab,var(--primary)_22%,transparent)]" tabIndex={-1}>Focus</Button>
              <Button variant="secondary" className="[--btn-inner:var(--btn-secondary-inner-hover)] !border-[var(--btn-secondary-border-hover)] !bg-[var(--btn-secondary-bg-hover)]" tabIndex={-1}>Hover</Button>
              <Button variant="secondary" className="[--btn-ring:0_0_0_2px_var(--primary),0_0_0_6px_color-mix(in_oklab,var(--primary)_22%,transparent)]" tabIndex={-1}>Focus</Button>
              <Button disabled>Disabled</Button>
              <Button disabled aria-busy="true">Sending…</Button>
            </div>
          </div>
        </div>
      )}
    </DsSection>
  );
}

// ------------------------------------------------------------------- forms --

function FormsSection() {
  return (
    <DsSection id="forms" title="Form controls" description="12px radius, thin borders, an Azure focus ring with a soft glow. Every input has a label; errors say what happened and how to fix it.">
      {(theme) => <FormsDemo theme={theme} />}
    </DsSection>
  );
}

function FormsDemo({ theme }: { theme: Theme }) {
  const [on, setOn] = useState(true);
  const p = `f-${theme}`;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id={`${p}-name`} label="Company name" hint="Shown on statements and receipts.">
        <Input id={`${p}-name`} defaultValue="Lanka Roam Travels" />
      </Field>
      <Field id={`${p}-amount`} label="Top-up amount" error="Enter an amount of at least €10.">
        <Input id={`${p}-amount`} defaultValue="5" aria-invalid="true" className="tabular" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${p}-act`}>Activation</Label>
        <Select defaultValue="first_use">
          <SelectTrigger id={`${p}-act`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">Activate now</SelectItem>
            <SelectItem value="first_use">On first use</SelectItem>
            <SelectItem value="date">On a set date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field id={`${p}-search`} label="Search">
        <Input id={`${p}-search`} placeholder="ICCID or customer" />
      </Field>
      <div className="sm:col-span-2">
        <Field id={`${p}-note`} label="Note">
          <Textarea id={`${p}-note`} placeholder="Bank transfer reference, anything we should know" />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Switch id={`${p}-sw`} checked={on} onCheckedChange={setOn} />
        <Label htmlFor={`${p}-sw`} className="text-body text-fg">Watermark on statements</Label>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id={`${p}-cb`} defaultChecked />
        <Label htmlFor={`${p}-cb`} className="text-body text-fg">Email the QR code to the customer</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id={`${p}-sw2`} disabled />
        <Label htmlFor={`${p}-sw2`} className="text-body text-fg-3">Disabled</Label>
      </div>
      <Input disabled placeholder="Disabled input" aria-label="Disabled input" />
    </div>
  );
}

// ------------------------------------------------------------------ status --

function StatusSection() {
  const esims: [EsimStatus, "admin" | "reseller" | "rule" | undefined][] = [
    ["ACTIVE", undefined], ["SUSPENDED", "reseller"], ["SUSPENDED", "admin"], ["SUSPENDED", "rule"], ["END_OF_LIFE", undefined], ["DISCONNECTED", undefined],
  ];
  const installs: InstallStatus[] = ["not_installed", "downloaded", "installed", "enabled", "disabled", "error"];
  return (
    <DsSection id="status" title="Status chips and values" description="A small glowing dot carries the colour; the label stays in the text colour so contrast never depends on it. Estimated amounts always carry the Estimated chip.">
      {() => (
        <div className="flex flex-col gap-5">
          <div>
            <SubLabel>eSIM</SubLabel>
            <div className="flex flex-wrap gap-2">{esims.map(([s, by], i) => <StatusChip key={i} status={esimStatus(s, by)} />)}</div>
          </div>
          <div>
            <SubLabel>Install status (unknown values show the supplier&apos;s raw string)</SubLabel>
            <div className="flex flex-wrap gap-2">
              {installs.map((s) => <StatusChip key={s} status={installStatus(s)} />)}
              <StatusChip status={installStatus("unknown", "Pending-Download-Retry")} />
            </div>
          </div>
          <div>
            <SubLabel>Plan on an eSIM</SubLabel>
            <div className="flex flex-wrap gap-2">{Object.entries(PLAN_STATE).map(([k, v]) => <StatusChip key={k} status={v} />)}</div>
          </div>
          <div>
            <SubLabel>Order</SubLabel>
            <div className="flex flex-wrap gap-2">{Object.entries(ORDER_STATUS).map(([k, v]) => <StatusChip key={k} status={v} />)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 tabular">€14.37 <EstimatedChip /></span>
            <NetworkBadges lte fiveG volte />
            <NetworkBadges lte />
            <MonoValue value="8937204016152290417" label="ICCID" group={4} />
          </div>
        </div>
      )}
    </DsSection>
  );
}

// ----------------------------------------------------------------- numbers --

function NumbersSection() {
  return (
    <DsSection id="numbers" title="Key numbers and usage" description="Large numbers with small quiet labels; dashboard numbers count up once. Usage: Azure to Emerald below 80%, warning from 80%, danger at 100%.">
      {() => (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatBlock label="Total eSIMs" value={132} />
            <StatBlock label="Active eSIMs" value={86} delta={0.072} />
            <StatBlock label="Data used" value={1248.4} format={(n) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })} GB`} delta={-0.031} />
            <StatBlock label="Available balance" value={2380.5} format={(n) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} hint="€420.00 held" />
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <UsageRing used={1.2} limit={3} />
            <UsageRing used={2.55} limit={3} />
            <UsageRing used={3} limit={3} />
            <div className="flex min-w-48 flex-1 flex-col gap-4">
              {[[0.4, "40%"], [0.86, "86%"], [1, "100%"]].map(([f, l]) => (
                <div key={String(l)} className="flex items-center gap-3">
                  <UsageBar used={Number(f)} limit={1} />
                  <span className="w-10 text-right text-small tabular text-fg-2">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DsSection>
  );
}

// ------------------------------------------------------------------- table --

function TableSection() {
  return (
    <DsSection id="table" title="Table" description="Comfortable rows, a sticky glass header, row hover in surface 3, status chips with a glowing dot, ICCIDs in Geist Mono with copy buttons." flush>
      {() => (
        <div className="flex flex-col">
          <div className="max-h-[340px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ICCID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Install</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="min-w-40">Data</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reseller</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...S.sampleEsims, ...S.sampleEsims].map((e, i) => (
                  <TableRow key={i}>
                    <TableCell><MonoValue value={e.iccid} label="ICCID" /></TableCell>
                    <TableCell><StatusChip status={esimStatus(e.status as EsimStatus, e.status === "SUSPENDED" ? "admin" : undefined)} /></TableCell>
                    <TableCell><StatusChip status={installStatus(e.install as InstallStatus, "raw" in e ? e.raw : undefined)} /></TableCell>
                    <TableCell>{e.plan}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UsageBar used={e.used} limit={e.limit} className="w-24" />
                        <span className="text-small tabular text-fg-2">{e.used} / {e.limit} GB</span>
                      </div>
                    </TableCell>
                    <TableCell>{e.customer}</TableCell>
                    <TableCell className="text-fg-2">{e.reseller}</TableCell>
                  </TableRow>
                ))}
                {[0, 1].map((i) => (
                  <TableRow key={`s${i}`} aria-hidden="true">
                    {Array.from({ length: 7 }, (_, c) => (
                      <TableCell key={c}><Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-20")} /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </DsSection>
  );
}

// ---------------------------------------------------------------- overlays --

function OverlaysSection() {
  return (
    <DsSection id="overlays" title="Dialogs, menus, tabs and toasts" description="Dialogs open with a blur-in backdrop. Destructive actions confirm; some need a typed confirmation and a reason for the audit log. A button and its toast use the same verb.">
      {(theme) => <OverlaysDemo theme={theme} />}
    </DsSection>
  );
}

function OverlaysDemo({ theme }: { theme: Theme }) {
  const [eol, setEol] = useState(false);
  const [block, setBlock] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="esims">eSIMs</TabsTrigger>
          <TabsTrigger value="wallet">Wallet and ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3 text-body text-fg-2">The active indicator glides between tabs.</TabsContent>
        <TabsContent value="esims" className="mt-3 text-body text-fg-2">128 eSIMs.</TabsContent>
        <TabsContent value="wallet" className="mt-3 text-body text-fg-2">Balance, held, available.</TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        <Button variant="destructive" onClick={() => setEol(true)}>Set end of life</Button>
        <Button variant="secondary" onClick={() => setBlock(true)}><Ban strokeWidth={1.5} /> Block plan</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary"><MoreHorizontal strokeWidth={1.5} /> Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>eSIM 8937…0417</DropdownMenuLabel>
            <DropdownMenuItem><Plus /> Add plan</DropdownMenuItem>
            <DropdownMenuItem><Download /> Download usage</DropdownMenuItem>
            <DropdownMenuItem><ShieldCheck /> Show PIN and PUK</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive><Pause /> Suspend eSIM</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="secondary" onClick={() => toast.success("eSIM suspended", { description: "8937 2040 1615 2290 417 can't use data until it's reactivated." })}>
          Suspend eSIM (toast)
        </Button>
        <Button variant="secondary" onClick={() => toast.error("Top-up not sent", { description: "The amount must be at least €10. Change it and try again." })}>
          Error toast
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(dialogPanelClass, "relative max-w-none")} aria-label="Dialog preview">
          <p className="text-section font-semibold">Request top-up</p>
          <p className="mt-1.5 text-body text-fg-2">We credit your wallet when the bank transfer arrives.</p>
          <div className="mt-5 flex flex-col gap-3">
            <Input aria-label="Amount" defaultValue="€500.00" className="tabular" />
            <Input aria-label="Bank transfer reference" placeholder="Bank transfer reference" />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm">Cancel</Button>
            <Button size="sm"><Wallet strokeWidth={1.5} /> Request top-up</Button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { icon: <ShieldCheck className="size-4 text-accent" strokeWidth={1.5} />, title: "Top-up approved", body: "€500.00 added. Two waiting plans started." },
            { icon: <CreditCard className="size-4 text-warning" strokeWidth={1.5} />, title: "Plan waiting for funds", body: "Italy 3 GB starts when your wallet covers the €9.80 hold." },
            { icon: <Ban className="size-4 text-danger" strokeWidth={1.5} />, title: "Selling refused", body: "Pay the outstanding €14.37 first. Request a top-up." },
          ].map((t) => (
            <div key={t.title} className="glass-pop flex items-start gap-3 rounded-[14px] px-4 py-3.5">
              <span className="mt-0.5">{t.icon}</span>
              <span>
                <span className="block font-medium">{t.title}</span>
                <span className="block text-small text-fg-2">{t.body}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={eol}
        onOpenChange={setEol}
        title="Set end of life"
        description="The eSIM stops working for good and its plans end."
        warning="Only the supplier can reverse this. We can't re-enable the eSIM."
        typeToConfirm={{ value: "8937204016152290417", label: "Type the ICCID to confirm" }}
        requireReason
        destructive
        confirmLabel="Set end of life"
        onConfirm={() => {
          toast.success("End of life set", { description: `Demo only (${theme} pane).` });
        }}
      />
      <ReasonDialog
        open={block}
        onOpenChange={setBlock}
        title="Block plan"
        description="The plan stops using data until it's unblocked. The hold stays in place."
        confirmLabel="Block plan"
        destructive
        onConfirm={() => {
          toast.success("Plan blocked");
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ charts --

function ChartsSection() {
  return (
    <DsSection id="charts" title="Charts" description="Glowing Azure lines with soft gradient fills, Emerald for the second series and positive values, faint grid, rounded bar ends, glass tooltips with the value first. Each chart draws in once when it comes into view.">
      {() => (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <UsageAreaChart data={S.dailyUsage} description="Last 30 days, GB. The last two days are estimated." />
          </div>
          <MonthlyBarChart data={S.monthlyUsage} />
          <StatusDonut data={S.esimStatus} />
          <PlansSoldChart data={S.plansSold} />
          <TransactionsChart data={S.transactions} />
          <TopEsimsBar data={S.topEsims} onSelect={(id) => toast(`Open ${id}`)} />
          <CountryBar data={S.usageByCountry} />
          <div className="md:col-span-2">
            <RevenueProfitChart data={S.revenue} />
          </div>
        </div>
      )}
    </DsSection>
  );
}

// --------------------------------------------------------------- eSIM card --

function EsimCardSection() {
  return (
    <DsSection id="esim-card" title="The eSIM card" description="A SIM-shaped card in dark glass with an Azure to Emerald edge light. It tilts toward the cursor with weighted inertia and a moving highlight (CSS 3D, no WebGL). Always dark glass, also on light pages. The QR stays black on white so it scans.">
      {() => (
        <div className="grid items-center gap-8 py-4 md:grid-cols-2">
          <EsimCard
            iccid="8937204016152290417"
            planName="Italy 3 GB"
            statusLabel="Active"
            lpa="LPA:1$smdp.example.net$K2-4X7P-9QTR-8LMA"
            usedBytes={2.1 * 1024 ** 3}
            limitBytes={3 * 1024 ** 3}
          />
          <EsimCard
            iccid="8937204016152291835"
            planName="Europe 10 GB"
            statusLabel="Active"
            lpa="LPA:1$smdp.example.net$P8-3KD2-77QZ-1MNE"
            usedBytes={8.6 * 1024 ** 3}
            limitBytes={10 * 1024 ** 3}
          />
        </div>
      )}
    </DsSection>
  );
}

// -------------------------------------------------------------- permissions --

function MatrixSection() {
  return (
    <DsSection id="matrix" title="Permission matrix" description="Grouped by the reseller navigation. Manage on turns View on; View off turns Manage off; a section switch toggles the whole section. Here the reseller can only view My plans, so Manage is greyed out with an explanation.">
      {(theme) => <MatrixDemo theme={theme} />}
    </DsSection>
  );
}

function MatrixDemo({ theme }: { theme: Theme }) {
  const envelope: Grants = { ...RESELLER_ENVELOPE, reseller_plans: "view" };
  const [value, setValue] = useState<Grants>({ dashboard: "view", sell_esim: "manage", esims: "manage", customers: "manage", coverage: "view", price_lists: "view" });
  return (
    <PermissionMatrix
      sections={RESELLER_MATRIX}
      value={value}
      envelope={envelope}
      onChange={setValue}
      idPrefix={`pm-${theme}`}
      envelopeReason="Your reseller account can't do this, so it can't be given to an assistant."
    />
  );
}

// ------------------------------------------------------------------ motion --

function MotionSection() {
  const [key, setKey] = useState(0);
  return (
    <DsSection id="motion" title="Motion" description="Weighted and silky: entrances ease out (0.22, 1, 0.36, 1), movement eases in and out (0.65, 0, 0.35, 1). 400–700 ms for reveals and layout, 150–200 ms for hovers. No springs, no overshoot. Reduced motion: no 3D or shader animation, no reveals, instant changes.">
      {() => (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3" key={key}>
            {["Fade and rise 14px", "Short stagger, 60 ms", "Once per page view"].map((t, i) => (
              <Reveal key={t} index={i}>
                <GlassCard className="h-full">
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-small text-fg-2">Reveal, item {i + 1}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setKey((k) => k + 1)}><RefreshCw strokeWidth={1.5} /> Replay reveal</Button>
            <span className="text-small text-fg-3">Helpers: Reveal, CountUp, useCursorGlow, useLerpedPointer, useReducedMotion, FpsMeter.</span>
          </div>
          <EasingCurves />
        </div>
      )}
    </DsSection>
  );
}

function EasingCurves() {
  const curves = [
    { name: "Entrances", d: "M0 100 C22 0 36 0 100 0" },
    { name: "Movement", d: "M0 100 C65 100 35 0 100 0" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {curves.map((c) => (
        <div key={c.name} className="glass-card p-4">
          <svg viewBox="-4 -4 108 108" className="h-24 w-full" aria-hidden="true">
            <path d="M0 100 H100 M0 100 V0" stroke="var(--border-strong)" strokeWidth="1" fill="none" />
            <path d={c.d} stroke="var(--primary)" strokeWidth="2" fill="none" style={{ filter: "drop-shadow(0 0 4px var(--primary-glow))" }} />
          </svg>
          <p className="mt-2 text-small text-fg-2">{c.name}</p>
        </div>
      ))}
    </div>
  );
}
