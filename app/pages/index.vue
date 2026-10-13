<script setup lang="ts">
const {
  offers,
  selectedOfferId,
  status,
  error,
  notice,
  purchase,
  loadOffers,
  buy,
  restore,
} = usePaywall();
const busy = computed(() =>
  ["loading", "purchasing", "restoring"].includes(status.value),
);
const orderedOffers = computed(() =>
  [...offers.value].sort(
    (a, b) => Number(b.recommended) - Number(a.recommended),
  ),
);
onMounted(loadOffers);
</script>
<template>
  <main class="paywall">
    <header class="brand">
      <span class="logo">amaya</span><span class="eyebrow">ДЛЯ РОДИТЕЛЕЙ</span>
    </header>
    <img
      class="mascot"
      src="/images/mascot.svg"
      alt="Лисёнок с книгой среди звёзд"
      width="342"
      height="156"
    />
    <template v-if="status === 'success'">
      <section class="success" aria-live="polite">
        <span class="success-check" aria-hidden="true">✓</span>
        <h1>Все приключения открыты!</h1>
        <p>Теперь доступны все игры, истории и открытия.</p>
        <p class="success-plan">
          {{
            purchase?.offerId === "yearly"
              ? "Доступ на целый год"
              : "Доступ на один месяц"
          }}
        </p>
        <span class="success-caption"
          >Тестовая покупка сохранена. Деньги не списывались.</span
        >
      </section>
    </template>
    <template v-else>
      <h1>Большой мир<br />маленьких открытий</h1>
      <p class="value">
        Все игры, истории и приключения<br />в одном безопасном пространстве.
      </p>
      <p class="benefits">
        ✦&nbsp; Без рекламы&nbsp;&nbsp;&nbsp;&nbsp; ✦&nbsp; Новые игры каждую
        неделю
      </p>
      <fieldset v-if="offers.length" class="offers" :disabled="busy">
        <legend class="sr-only">Выберите тариф</legend>
        <OfferCard
          v-for="offer in orderedOffers"
          :key="offer.id"
          :offer="offer"
          :selected="selectedOfferId === offer.id"
          :disabled="busy"
          @select="selectedOfferId = $event"
        />
      </fieldset>
      <div
        v-else-if="status === 'loading'"
        class="loading-offers"
        role="status"
      >
        <span class="spinner" />Загружаем тарифы…
      </div>
      <div v-if="error" class="message error" role="alert">{{ error }}</div>
      <div v-if="notice" class="message" role="status">{{ notice }}</div>
      <button v-if="offers.length" class="cta" :disabled="busy" @click="buy">
        <template v-if="status === 'purchasing'"
          ><span class="spinner" />Открываем доступ…</template
        >
        <template v-else>Открыть полный доступ&nbsp; →</template>
      </button>
      <button v-else-if="status === 'error'" class="cta" @click="loadOffers">
        Попробовать снова
      </button>
      <button
        class="restore"
        :disabled="busy || !offers.length"
        @click="restore"
      >
        {{
          status === "restoring" ? "Восстанавливаем…" : "Восстановить покупки"
        }}
      </button>
    </template>
    <p class="demo-notice">Тестовая покупка. Деньги не списываются.</p>
  </main>
</template>
