<script setup lang="ts">
import type { Offer } from "../../shared/types/paywall";
const props = defineProps<{
  offer: Offer;
  selected: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ select: [id: Offer["id"]] }>();
const price = computed(() =>
  new Intl.NumberFormat("ru-RU")
    .format(props.offer.amount / 100)
    .replace(/\u00a0/g, " "),
);
</script>
<template>
  <label
    class="offer"
    :class="{ selected, annual: offer.recommended, disabled }"
  >
    <input
      type="radio"
      name="offer"
      :value="offer.id"
      :checked="selected"
      :disabled="disabled"
      @change="emit('select', offer.id)"
    />
    <span class="offer-details">
      <span v-if="offer.recommended" class="savings">ВЫГОДНЕЕ НА 45%</span>
      <span class="offer-title">{{ offer.title }}</span>
      <span class="price-line"
        ><strong>{{ price }} ₽</strong
        ><span>/ {{ offer.period === "year" ? "год" : "месяц" }}</span></span
      >
    </span>
    <span class="radio-indicator" aria-hidden="true"
      ><span v-if="selected"
    /></span>
  </label>
</template>
