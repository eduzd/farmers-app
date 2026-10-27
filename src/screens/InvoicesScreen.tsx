import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Share,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/icons/Feather";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useInvoiceStore, Invoice } from "@/lib/invoiceStore";
import { useAuthStore } from "@/lib/authStore";
import { useI18n } from "@/lib/i18n";

import { AppIcon } from "@/components/icons/AppIcon";
const getPaymentStatusConfig = (status: Invoice["paymentStatus"]) => {
  const configs: Record<string, { color: string; labelBn: string; labelEn: string; icon: string }> = {
    paid: { color: "#2E96EF", labelBn: "পেইড", labelEn: "Paid", icon: "check-circle" },
    unpaid: { color: "#DA2F2F", labelBn: "আনপেইড", labelEn: "Unpaid", icon: "alert-circle" },
    partial: { color: "#B25E09", labelBn: "আংশিক", labelEn: "Partial", icon: "clock" },
  };
  return configs[status] || configs.unpaid;
};

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { language } = useI18n();
  const isBn = language === "bn";
  const { user } = useAuthStore();
  
  const { invoices, getInvoicesByBuyer, getInvoicesBySeller } = useInvoiceStore();
  const [viewMode, setViewMode] = useState<"buyer" | "seller">("buyer");

  const displayInvoices = user?.id
    ? viewMode === "buyer"
      ? getInvoicesByBuyer(user.id)
      : getInvoicesBySeller(user.id)
    : invoices;

  const invoiceHtml = (invoice: Invoice) => {
    const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
    const c = esc(invoice.currency);
    const rows = invoice.items
      .map((i) => `<tr><td>${esc(i.name)}</td><td>${i.quantity} ${esc(i.unit)}</td><td>${c}${i.unitPrice}</td><td>${c}${i.total}</td></tr>`)
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.invoiceNumber)}</title>
<style>body{font-family:system-ui,'Noto Sans Bengali',sans-serif;padding:24px;color:#1A2B22}h1{color:#2E96EF;margin:0}
table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}
.row{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-top:16px}.tot{text-align:right;margin-top:12px}</style></head>
<body><h1>${isBn ? "ইনভয়েস" : "Invoice"} ${esc(invoice.invoiceNumber)}</h1>
<div>${new Date(invoice.createdAt).toLocaleDateString(isBn ? "bn-BD" : "en-US")} · ${esc(invoice.paymentStatus)}</div>
<div class="row"><div><b>${isBn ? "বিক্রেতা" : "Seller"}</b><br>${esc(invoice.sellerName)}<br>${esc(invoice.sellerAddress)}<br>${esc(invoice.sellerPhone)}</div>
<div><b>${isBn ? "ক্রেতা" : "Buyer"}</b><br>${esc(invoice.buyerName)}<br>${esc(invoice.buyerAddress)}<br>${esc(invoice.buyerPhone)}</div></div>
<table><tr><th>${isBn ? "পণ্য" : "Item"}</th><th>${isBn ? "পরিমাণ" : "Qty"}</th><th>${isBn ? "দর" : "Price"}</th><th>${isBn ? "মোট" : "Total"}</th></tr>${rows}</table>
<div class="tot">${isBn ? "সাবটোটাল" : "Subtotal"}: ${c}${invoice.subtotal}<br>${isBn ? "ছাড়" : "Discount"}: ${c}${invoice.discount}<br>${isBn ? "ট্যাক্স" : "Tax"}: ${c}${invoice.tax}<br>${isBn ? "শিপিং" : "Shipping"}: ${c}${invoice.shippingCost}<br><b>${isBn ? "সর্বমোট" : "Total"}: ${c}${invoice.total}</b></div>
${invoice.notes ? `<p>${esc(invoice.notes)}</p>` : ""}</body></html>`;
  };

  const handlePdf = async (invoice: Invoice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const html = invoiceHtml(invoice);
      if (Platform.OS === "web") {
        // opens the browser's print dialog, where "Save as PDF" is available
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("PDF", uri);
      }
    } catch (e: any) {
      Alert.alert(isBn ? "PDF তৈরি হয়নি" : "Couldn't create PDF", e?.message || "");
    }
  };

  const handleShare = async (invoice: Invoice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const itemsList = invoice.items
      .map((item) => `${item.name}: ${item.quantity} ${item.unit} x ${invoice.currency}${item.unitPrice} = ${invoice.currency}${item.total}`)
      .join("\n");

    const message = `
${isBn ? "ইনভয়েস" : "Invoice"}: ${invoice.invoiceNumber}
${isBn ? "তারিখ" : "Date"}: ${new Date(invoice.createdAt).toLocaleDateString(isBn ? "bn-BD" : "en-US")}

${isBn ? "বিক্রেতা" : "Seller"}: ${invoice.sellerName}
${invoice.sellerAddress}
${invoice.sellerPhone}

${isBn ? "ক্রেতা" : "Buyer"}: ${invoice.buyerName}
${invoice.buyerAddress}
${invoice.buyerPhone}

${isBn ? "আইটেম" : "Items"}:
${itemsList}

${isBn ? "সাবটোটাল" : "Subtotal"}: ${invoice.currency}${invoice.subtotal}
${invoice.discountPercent > 0 ? `${isBn ? "ছাড়" : "Discount"} (${invoice.discountPercent}%): -${invoice.currency}${invoice.discount}` : ""}
${invoice.shippingCost > 0 ? `${isBn ? "শিপিং" : "Shipping"}: ${invoice.currency}${invoice.shippingCost}` : ""}
${isBn ? "মোট" : "Total"}: ${invoice.currency}${invoice.total}

${isBn ? "পেমেন্ট স্ট্যাটাস" : "Payment Status"}: ${getPaymentStatusConfig(invoice.paymentStatus)[isBn ? "labelBn" : "labelEn"]}
${invoice.notes ? `\n${isBn ? "নোট" : "Note"}: ${invoice.notes}` : ""}
    `.trim();

    try {
      await Share.share({ message });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const renderInvoice = ({ item: invoice, index }: { item: Invoice; index: number }) => {
    const statusConfig = getPaymentStatusConfig(invoice.paymentStatus);

    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <Pressable
          style={[styles.invoiceCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <View style={styles.cardHeader}>
            <View>
              <ThemedText style={[styles.invoiceNumber, { color: theme.primary }]}>
                {invoice.invoiceNumber}
              </ThemedText>
              <ThemedText style={[styles.invoiceDate, { color: theme.textSecondary }]}>
                {new Date(invoice.createdAt).toLocaleDateString(isBn ? "bn-BD" : "en-US")}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "20" }]}>
              <AppIcon name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                {isBn ? statusConfig.labelBn : statusConfig.labelEn}
              </ThemedText>
            </View>
          </View>

          <View style={styles.partyInfo}>
            <View style={styles.partyRow}>
              <Feather name="user" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.partyName, { color: theme.text }]}>
                {viewMode === "buyer" ? invoice.sellerName : invoice.buyerName}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.itemsSummary, { backgroundColor: theme.backgroundRoot }]}>
            {invoice.items.slice(0, 2).map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <ThemedText style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText style={[styles.itemTotal, { color: theme.textSecondary }]}>
                  {invoice.currency}{item.total}
                </ThemedText>
              </View>
            ))}
            {invoice.items.length > 2 ? (
              <ThemedText style={[styles.moreItems, { color: theme.textSecondary }]}>
                +{invoice.items.length - 2} {isBn ? "আরো আইটেম" : "more items"}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.totalRow}>
            <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>
              {isBn ? "মোট" : "Total"}
            </ThemedText>
            <ThemedText style={[styles.totalAmount, { color: theme.primary }]}>
              {invoice.currency}{invoice.total}
            </ThemedText>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
              onPress={() => handlePdf(invoice)}
            >
              <Feather name="eye" size={16} color={theme.primary} />
              <ThemedText style={[styles.actionText, { color: theme.text }]}>
                {isBn ? "দেখুন" : "View"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
              onPress={() => handleShare(invoice)}
            >
              <Feather name="share-2" size={16} color={theme.primary} />
              <ThemedText style={[styles.actionText, { color: theme.text }]}>
                {isBn ? "শেয়ার" : "Share"}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
              onPress={() => handlePdf(invoice)}
            >
              <Feather name="download" size={16} color={theme.primary} />
              <ThemedText style={[styles.actionText, { color: theme.primary }]}>
                PDF
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.tabContainer}>
        {[
          { id: "buyer", labelBn: "আমার ক্রয়", labelEn: "My Purchases", icon: "shopping-bag" },
          { id: "seller", labelBn: "আমার বিক্রয়", labelEn: "My Sales", icon: "package" },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              { backgroundColor: viewMode === tab.id ? theme.primary : theme.card },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode(tab.id as any);
            }}
          >
            <AppIcon
              name={tab.icon as any}
              size={16}
              color={viewMode === tab.id ? "#FFF" : theme.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, { color: viewMode === tab.id ? "#FFF" : theme.text }]}
            >
              {isBn ? tab.labelBn : tab.labelEn}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={displayInvoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Feather name="file-text" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              {isBn ? "কোনো ইনভয়েস নেই" : "No Invoices"}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isBn
                ? "আপনার লেনদেনের ইনভয়েস এখানে দেখা যাবে"
                : "Invoices from your transactions will appear here"}
            </ThemedText>
          </Animated.View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    // Uniform tab size: never squeezed by its neighbours or its label length.
    minHeight: 44,
    paddingHorizontal: 4,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "DMSans_600SemiBold",
  },
  list: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  invoiceCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  invoiceNumber: {
    fontSize: 16,
    fontFamily: "DMSans_700Bold",
  },
  invoiceDate: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "DMSans_600SemiBold",
  },
  partyInfo: {
    marginBottom: Spacing.md,
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  partyName: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
  },
  itemsSummary: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
  },
  itemTotal: {
    fontSize: 13,
    fontFamily: "DMSans_500Medium",
  },
  moreItems: {
    fontSize: 12,
    fontFamily: "DMSans_400Regular",
    fontStyle: "italic",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: "DMSans_500Medium",
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "DMSans_700Bold",
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "DMSans_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "DMSans_700Bold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
