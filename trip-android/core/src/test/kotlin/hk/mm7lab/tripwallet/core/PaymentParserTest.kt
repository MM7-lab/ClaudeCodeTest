package hk.mm7lab.tripwallet.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.assertFalse

class PaymentParserTest {
    private fun p(title: String, body: String, label: String = "Bank", pkg: String = "com.example.bank") =
        PaymentParser.parse(title, body, label, pkg)

    @Test fun payMeHkd() {
        val r = p("PayMe", "你已付款 HK$50.00 給 7-Eleven", "PayMe", "com.hsbc.payme")!!
        assertEquals(50.0, r.amount); assertEquals("HKD", r.currency); assertEquals("PayMe", r.method)
    }

    @Test fun creditCardInJapan() {
        val r = p("信用卡交易提示", "Your card ending 1234 was used for JPY 12,345 at DON QUIJOTE")!!
        assertEquals(12345.0, r.amount); assertEquals("JPY", r.currency); assertEquals("信用卡", r.method)
    }

    @Test fun payPayYenSuffix() {
        val r = p("支払い完了", "ローソン 1,280円", "PayPay", "jp.ne.paypay.android.app")!!
        assertEquals(1280.0, r.amount); assertEquals("JPY", r.currency); assertEquals("PayPay", r.method)
    }

    @Test fun octopusSkipsBalance() {
        val r = p("八達通", "付款 $12.30 餘額 $150.20", "Octopus", "com.octopuscards.nfc_reader")!!
        assertEquals(12.3, r.amount); assertEquals("HKD", r.currency); assertEquals("八達通", r.method)
    }

    @Test fun balanceFirstStillPicksSpend() {
        val r = p("Card", "Available balance: HKD 1,000.00. Spent HKD 20.00 at MTR")!!
        assertEquals(20.0, r.amount)
    }

    @Test fun walletSuica() {
        val r = p("Suica", "¥980 · JR East", "Wallet", "com.google.android.apps.walletnfcrel")!!
        assertEquals(980.0, r.amount); assertEquals("JPY", r.currency); assertEquals("Suica / ICOCA", r.method)
    }

    @Test fun otpIsIgnored() = assertNull(p("HSBC", "Your OTP is 123456 for a HKD 500.00 transaction"))
    @Test fun chineseCodeIsIgnored() = assertNull(p("中銀", "一次性密碼 482910，交易金額 HKD 88.00"))
    @Test fun receivedIsIgnored() = assertNull(p("PayMe", "你已收到 HK$100.00", "PayMe", "com.hsbc.payme"))
    @Test fun topUpIsIgnored() = assertNull(p("八達通", "增值 $200.00 成功", "Octopus", "com.octopuscards.nfc_reader"))
    @Test fun refundIsIgnored() = assertNull(p("Card", "Refund of JPY 3,000 from UNIQLO"))
    @Test fun rmbIsIgnored() = assertNull(p("支付寶", "付款 ¥50.00 人民幣", "Alipay", "com.alipay.android.app"))
    @Test fun noAmount() = assertNull(p("HSBC", "Your statement is ready"))
    @Test fun shoppingIsNotPin() = assertEquals(35.0, p("Card", "Shopping HKD 35.00 at Uniqlo")!!.amount)

    @Test fun suffixHkd() {
        val r = p("Card", "交易 1,234.50 港元 @ 百佳")!!
        assertEquals(1234.5, r.amount); assertEquals("HKD", r.currency)
    }

    @Test fun paymentApps() {
        assertTrue(PaymentParser.isLikelyPaymentApp("八達通", "com.octopuscards.nfc_reader"))
        assertTrue(PaymentParser.isLikelyPaymentApp("HSBC HK", "hk.com.hsbc.hsbchkmobilebanking"))
        assertTrue(PaymentParser.isLikelyPaymentApp("PayPay", "jp.ne.paypay.android.app"))
        assertFalse(PaymentParser.isLikelyPaymentApp("WhatsApp", "com.whatsapp"))
        assertFalse(PaymentParser.isLikelyPaymentApp("Instagram", "com.instagram.android"))
    }
}
