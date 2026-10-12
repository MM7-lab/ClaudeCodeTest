package hk.mm7lab.tripwallet.core

/** A payment read out of one notification. [currency] is "HKD" or "JPY". */
data class Payment(
    val amount: Double,
    val currency: String,
    val method: String,
    val text: String,
)

/**
 * Reads the amount spent out of a payment app's notification (Octopus, PayMe, bank and
 * credit card apps, Google Wallet, PayPay and so on), in HKD or JPY.
 *
 * Anything that looks like a one-time password or a security code is dropped before the
 * amount is looked at, and so is money coming in (received, refund, top-up).
 */
object PaymentParser {
    private val SECRET = Regex(
        "(?i)otp|one[- ]?time|一次性|驗證碼|验证码|verification|passcode|password|\\bpin\\b|密碼|密码|認證碼|security code|保安編碼|保安碼",
    )
    private val NOT_SPENDING = Regex(
        "(?i)收到|已收|收款|received|退款|退還|退回|refund|reversal|credited|存入|增值|充值|top[- ]?up|轉入|入賬|入账|cashback|回贈|返還",
    )
    private val OTHER_CURRENCY = Regex("(?i)\\b(CNY|RMB|USD|TWD|NT\\$|SGD|EUR|GBP|KRW|THB|MOP)\\b|人民幣|人民币|美元|台幣|新台幣")
    private val BALANCE_BEFORE = Regex("(?i)(餘額|余额|結餘|balance|可用|available|limit|限額|額度|信用額)[^0-9]{0,10}$")

    private const val NUM = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)"

    private class Rule(val regex: Regex, val currency: String, val explicit: Boolean)

    private val RULES = listOf(
        Rule(Regex("(?i)(?:HK\\$|HKD|港幣|港币|港元)\\s?$NUM"), "HKD", true),
        Rule(Regex("(?i)(?:JPY|¥|￥|日圓|日元|日幣)\\s?$NUM"), "JPY", true),
        Rule(Regex("(?i)$NUM\\s?(?:HKD|港幣|港币|港元)"), "HKD", true),
        Rule(Regex("(?i)$NUM\\s?(?:JPY|円|日圓|日元|yen\\b)"), "JPY", true),
        // A bare "$" (not part of HK$, US$, NT$ …) in a Hong Kong app means HKD.
        Rule(Regex("(?<![A-Za-z])\\$\\s?$NUM"), "HKD", false),
    )

    private val PAYMENT_APP_WORDS = listOf(
        "octopus", "八達通", "payme", "paypay", "suica", "icoca", "pasmo", "wallet", "alipay", "支付寶",
        "wechat", "微信", "tap & go", "tapngo", "hsbc", "滙豐", "匯豐", "hang seng", "hangseng", "恒生",
        "boc", "中銀", "中國銀行", "standard chartered", "scb", "渣打", "citi", "花旗", "dbs", "星展",
        "aeon", "bea", "東亞", "mox", "za bank", "zabank", "welab", "livi", "airstar", "fusion bank",
        "ant bank", "american express", "amex", "visa", "mastercard", "bank", "銀行", "card", "信用卡",
    )

    /** Whether an app looks like a payment or bank app, so it is watched until the person says otherwise. */
    fun isLikelyPaymentApp(label: String, packageName: String): Boolean {
        val s = "$label $packageName".lowercase()
        return PAYMENT_APP_WORDS.any { it in s }
    }

    /** The payment method to file this under, matching the tracker's own list. */
    fun methodFor(label: String, packageName: String, text: String): String {
        val app = "$label $packageName".lowercase()
        val all = "$app ${text.lowercase()}"
        return when {
            "octopus" in app || "八達通" in app -> "八達通"
            "payme" in app -> "PayMe"
            "paypay" in app -> "PayPay"
            "alipay" in app || "支付寶" in app -> "AlipayHK"
            "wechat" in app || "微信" in app || "tencent.mm" in app -> "WeChat Pay"
            "suica" in all || "icoca" in all || "pasmo" in all -> "Suica / ICOCA"
            "八達通" in all || "octopus" in all -> "八達通"
            else -> "信用卡"
        }
    }

    fun parse(title: String, body: String, label: String, packageName: String): Payment? {
        val text = listOf(title, body).filter { it.isNotBlank() }.joinToString(" ").replace(Regex("\\s+"), " ").trim()
        if (text.isEmpty()) return null
        if (SECRET.containsMatchIn(text)) return null
        if (NOT_SPENDING.containsMatchIn(text)) return null
        if (OTHER_CURRENCY.containsMatchIn(text)) return null

        data class Hit(val at: Int, val amount: Double, val currency: String, val explicit: Boolean)

        val hits = RULES.flatMap { rule ->
            rule.regex.findAll(text).mapNotNull { m ->
                val before = text.substring(0, m.range.first)
                if (BALANCE_BEFORE.containsMatchIn(before)) return@mapNotNull null
                val amount = m.groupValues[1].replace(",", "").toDoubleOrNull() ?: return@mapNotNull null
                if (amount <= 0.0 || amount >= 10_000_000.0) return@mapNotNull null
                Hit(m.range.first, amount, rule.currency, rule.explicit)
            }.toList()
        }
        val pick = (hits.filter { it.explicit }.ifEmpty { hits }).minByOrNull { it.at } ?: return null
        return Payment(
            amount = pick.amount,
            currency = pick.currency,
            method = methodFor(label, packageName, text),
            text = text.take(80),
        )
    }
}
