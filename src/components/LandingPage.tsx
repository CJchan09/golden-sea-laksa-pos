import React from 'react';
import {
  ArrowRight,
  ChefHat,
  CloudOff,
  MonitorSmartphone,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { APP_ICON_SRC } from '../brand';

interface Props {
  onStart: () => void;
  onAdmin: () => void;
  onKitchen: () => void;
}

const heroSrc = `${import.meta.env.BASE_URL}assets/pos-hero-v2-black-yellow.png`;

export default function LandingPage({ onStart, onAdmin, onKitchen }: Props) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-zinc-950 font-display text-white">
      <header className="pt-safe border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={APP_ICON_SRC} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg shadow-black/30" />
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">CJ F&amp;B POS</p>
              <p className="text-xs font-semibold text-white/60">Public test build · 公开测试版</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onKitchen}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-bold text-white/85 transition-colors hover:border-primary/70 hover:bg-white/5 hover:text-primary"
          >
            <ChefHat className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Kitchen Display</span>
            <span className="sm:hidden">KDS</span>
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Phase 1 foundation tested
            </div>

            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              One simple flow from order to kitchen.
            </h1>
            <p className="mt-5 max-w-lg text-pretty text-lg leading-8 text-white/72">
              给马来西亚小型餐饮商家的通用点单、收银和厨房流程。先体验示范店，再进入员工后台检查实际操作。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onStart}
                className="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-xl bg-primary px-6 text-base font-extrabold text-on-primary shadow-xl shadow-black/30 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0"
              >
                <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
                Try sample store / 试用示范店
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onAdmin}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-base font-bold text-white transition-colors hover:border-white/35 hover:bg-white/10"
              >
                <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
                Staff console
              </button>
            </div>

            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-white/55">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              当前为朋友公开测试版；资料只保存在这台设备，安装与断网重开会在 PWA 阶段验收。
            </p>
          </div>

          <figure className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-2xl shadow-black/35">
            <img
              src={heroSrc}
              alt="Illustration of a restaurant POS tablet coordinating orders, receipts and takeaway service"
              className="aspect-[3/2] h-full w-full object-cover"
              loading="eager"
            />
            <figcaption className="absolute inset-x-4 bottom-4 rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-md sm:inset-x-6 sm:bottom-6">
              Customer order · Cashier · Kitchen display
            </figcaption>
          </figure>
        </section>

        <section className="border-y border-white/10 bg-white/[0.035]">
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              ['01', 'Customer ordering', '顾客手机浏览、选配与提交订单。'],
              ['02', 'Cashier control', '员工确认付款、处理进行中订单。'],
              ['03', 'Kitchen clarity', '厨房按等待顺序制作并标记完成。'],
            ].map(([number, title, body]) => (
              <article key={number} className="rounded-2xl border border-white/10 bg-black/15 p-5">
                <p className="text-sm font-extrabold text-primary">{number}</p>
                <h2 className="mt-2 text-lg font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-6 text-xs leading-5 text-white/45 sm:px-6 lg:px-8">
        <span>Working product name: CJ F&amp;B POS</span>
        <span>Local device access is not a secure cloud account.</span>
      </footer>
    </div>
  );
}
