package hk.mm7.ledger;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pulls an amount, direction and merchant out of a payment notification's text.
 * Pure Java so it can be tested off-device. It errs on the side of skipping:
 * a notification needs both a payment word and an HK$ amount, and anything that
 * looks like a one-time password, a promotion or a top-up is ignored.
 */
final class PaymentParser {

    static final class Result {
        final double amount;
        final String type; // "exp" or "inc"
        final String note;

        Result(double amount, String type, String note) {
            this.amount = amount;
            this.type = type;
            this.note = note;
        }
    }

    // Chat, social and mail apps: people type amounts in messages, so these are never read.
    // The phone's default SMS app is skipped separately (see PaymentListener).
    private static final Set<String> EXCLUDED = new HashSet<>(Arrays.asList(
            "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thoughtcrime.securesms",
            "jp.naver.line.android", "com.tencent.mm", "com.facebook.orca", "com.facebook.katana",
            "com.instagram.android", "com.discord", "com.Slack", "com.google.android.gm",
            "com.microsoft.office.outlook", "com.google.android.apps.messaging", "com.samsung.android.messaging",
            "com.android.mms", "com.google.android.dialer", "com.android.systemui", "com.android.vending",
            "com.twitter.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.aweme", "com.xingin.xhs",
            "com.google.android.youtube", "com.signal", "com.viber.voip", "kik.android", "com.snapchat.android"));

    private static final Pattern OTP = Pattern.compile(
            "(?i)(otp|one[- ]?time|passcode|verification code|security code|驗證碼|验证码|一次性密碼|確認碼|密碼|登入|log ?in)");
    private static final Pattern PROMO = Pattern.compile(
            "(?i)(優惠|推廣|獎賞|即享|低至|限時|抽獎|賺取|高達|折扣|著數|新用戶|邀請|offer|promo|reward|discount|% ?off|coupon|cashback up to)");
    // A top-up moves money between your own accounts (e.g. card -> Octopus); recording it as spending would count it twice.
    private static final Pattern TOP_UP = Pattern.compile("(?i)(增值|充值|top[- ]?up|reload)");
    private static final Pattern PAY = Pattern.compile(
            "(?i)(付款|支付|已付|消費|簽賬|簽帳|交易|扣款|扣除|扣賬|扣帳|繳費|收款|收到|轉賬|轉帳|入賬|入帳|存入|退款|車費|"
                    + "payment|paid|spent|purchase|transaction|charged|debited|received|credited|refund|transfer|sent you)");
    private static final Pattern INCOME = Pattern.compile(
            "(?i)(收款(?!人)|收到|已收|入賬|入帳|存入|退款|退還|向你|向您|給你|給您|received|credited|refund|deposit|sent you|paid you)");
    // Someone paying you: "陳大文向你轉帳…", "你收到陳大文嘅付款…", "陳大文 sent you…".
    private static final Pattern PAYER = Pattern.compile(
            "(?i)(?:([^\\s，,。:：]{2,20})\\s*(?:向你|向您|給你|給您|sent you|paid you))|(?:收到\\s*([^\\s，,。:：]{2,20}?)\\s*(?:嘅|的))");
    // Balances and limits carry amounts too; drop them before looking for the payment amount.
    private static final Pattern BALANCE = Pattern.compile(
            "(?i)(餘額|余额|結餘|可用額|可用信用額|信用額|剩餘|balance|available|credit limit)\\s*[:：為为]?\\s*"
                    + "(?:HK\\$|HKD|\\$|港幣|港元)?\\s*-?[0-9][0-9,]*(?:\\.[0-9]+)?");
    private static final String NUM = "([0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)";
    private static final Pattern AMT_PRE = Pattern.compile("(?i)(?:HK\\$|HKD|港幣|港元|\\$)\\s*" + NUM);
    private static final Pattern AMT_POST = Pattern.compile("(?i)" + NUM + "\\s*(?:HKD|港幣|港元|元)");
    private static final Pattern MERCHANT = Pattern.compile(
            "(?i)(?:\\bat\\b|\\bto\\b|\\bfrom\\b|於|在|向|給|予|商戶[:：]?)\\s*([^,，。;；\\n]{2,40}?)\\s*"
                    + "(?:\\bon\\b|消費|付款|簽賬|簽帳|交易|作出|進行|轉賬|轉帳|[,，。;；\\n]|\\.\\s|\\.$|$)");
    private static final Pattern MONEY = Pattern.compile("(?i)(?:HK\\$|HKD|\\$|港幣|港元)\\s*[0-9][0-9,]*(?:\\.[0-9]+)?|[0-9][0-9,]*(?:\\.[0-9]+)?\\s*(?:HKD|港幣|港元|元)");
    private static final Pattern NOT_A_NAME = Pattern.compile("(?i)(you|your( account| card| a/c)?|the|a|an|你|您|閣下|你的帳戶|您的帳戶|閣下的帳戶)");

    private PaymentParser() {}

    static boolean isExcludedPackage(String pkg) {
        return pkg == null || EXCLUDED.contains(pkg);
    }

    static Result parse(String title, String text) {
        String all = ((title == null ? "" : title) + "\n" + (text == null ? "" : text)).trim();
        if (all.isEmpty() || all.length() > 2000) return null;
        if (OTP.matcher(all).find() || PROMO.matcher(all).find() || TOP_UP.matcher(all).find()) return null;
        if (!PAY.matcher(all).find()) return null;

        String cleaned = BALANCE.matcher(all).replaceAll(" ");
        String num = null;
        Matcher m = AMT_PRE.matcher(cleaned);
        if (m.find()) num = m.group(1);
        if (num == null) {
            m = AMT_POST.matcher(cleaned);
            if (m.find()) num = m.group(1);
        }
        if (num == null) return null;
        double v;
        try {
            v = Double.parseDouble(num.replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
        if (!(v > 0) || v >= 1e9) return null;
        v = Math.round(v * 100) / 100.0;

        String type = INCOME.matcher(cleaned).find() ? "inc" : "exp";
        return new Result(v, type, merchant(title, cleaned));
    }

    private static String merchant(String title, String cleaned) {
        Matcher p = PAYER.matcher(cleaned);
        if (p.find()) {
            String who = p.group(1) != null ? p.group(1) : p.group(2);
            if (who != null && !NOT_A_NAME.matcher(who).matches()) return clip(who);
        }
        Matcher m = MERCHANT.matcher(cleaned);
        while (m.find()) {
            String s = MONEY.matcher(m.group(1)).replaceAll(" ").replaceAll("\\s+", " ").trim();
            if (s.length() >= 2 && !NOT_A_NAME.matcher(s).matches()) return clip(s);
        }
        if (title != null) {
            String t = title.trim();
            if (!t.isEmpty() && t.length() <= 30 && !MONEY.matcher(t).find()) return clip(t);
        }
        return "";
    }

    private static String clip(String s) {
        return s.length() > 40 ? s.substring(0, 40) : s;
    }
}
