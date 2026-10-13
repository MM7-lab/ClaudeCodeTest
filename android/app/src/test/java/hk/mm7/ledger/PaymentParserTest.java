package hk.mm7.ledger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

/**
 * Sample texts are written in the style of HK payment notifications; they are not copied
 * from real apps. Add a real (anonymised) notification here whenever one is misread.
 */
public class PaymentParserTest {

    private static void check(String title, String text, Double amount, String type, String note) {
        PaymentParser.Result r = PaymentParser.parse(title, text);
        if (amount == null) {
            assertNull(title + " / " + text, r);
            return;
        }
        assertNotNull(title + " / " + text, r);
        assertEquals(amount, r.amount, 0.001);
        assertEquals(type, r.type);
        if (note != null) assertEquals(note, r.note);
    }

    @Test
    public void wallets() {
        // Google Wallet / Samsung Wallet style: merchant in the title, amount without a payment word.
        PaymentParser.Result g = PaymentParser.parse("7-Eleven", "HK$45.00 · Visa ••1234", true);
        assertNotNull(g);
        assertEquals(45.0, g.amount, 0.001);
        assertEquals("exp", g.type);
        assertEquals("7-Eleven", g.note);
        assertNull(PaymentParser.parse("7-Eleven", "HK$45.00 · Visa ••1234", false));
        PaymentParser.Result s = PaymentParser.parse("Samsung Wallet", "已使用 Visa 付款 HK$88.50", true);
        assertEquals(88.5, s.amount, 0.001);
        assertEquals("", s.note);
        PaymentParser.Result none = PaymentParser.parse("Samsung Wallet", "付款完成", true);
        assertNotNull(none);
        assertEquals(true, none.needAmount);
        assertEquals(0, none.amount, 0.001);
        assertNull(PaymentParser.parse("Google Wallet", "Your card is ready to use", true));
        assertNull(PaymentParser.parse("Samsung Wallet", "Verification code 123456 for HK$500", true));
        assertEquals("略過：冇付款字眼", PaymentParser.why("7-Eleven", "HK$45.00 · Visa ••1234", false));
        assertEquals("當付款 45.0", PaymentParser.why("7-Eleven", "HK$45.00 · Visa ••1234", true));
    }

    @Test
    public void samples() {
        check("八達通", "你已於 7-Eleven 消費 HK$23.5，餘額 HK$156.2", 23.5, "exp", "7-Eleven");
        check("Octopus", "Payment of HK$12.30 at MTR Corporation. Remaining balance: HK$45.60", 12.3, "exp", "MTR Corporation");
        check("PayMe", "你已付款 $50 給 陳大文", 50.0, "exp", "陳大文");
        check("PayMe", "你收到 陳大文 嘅付款 $120", 120.0, "inc", "陳大文");
        check("PayMe", "陳大文向你轉帳 HK$300.00", 300.0, "inc", "陳大文");
        check("PayMe", "Chan Tai Man sent you HK$40.00", 40.0, "inc", null);
        check("PayMe", "你已向 陳大文 付款 HK$66", 66.0, "exp", "陳大文");
        check("mox", "You spent HK$1,234.56 at AMAZON MKTPLACE on 13 Oct", 1234.56, "exp", "AMAZON MKTPLACE");
        check("信用卡交易通知", "閣下尾號1234的信用卡於 McDonald's 簽賬 HKD 45.00", 45.0, "exp", "McDonald's");
        check("Bank", "HKD 8,000.00 has been credited to your account", 8000.0, "inc", null);
        check("Bank", "Your one-time password is 123456 for HK$500 payment", null, null, null);
        check("驗證碼", "交易驗證碼 882211，金額 HK$300", null, null, null);
        check("優惠", "簽賬滿 $500 即享 $50 回贈！", null, null, null);
        check("八達通", "自動增值 $250 已完成", null, null, null);
        check("Hello", "記得今晚 7 點食飯", null, null, null);
        check("交易提示", "已扣款 120 港元，商戶：百佳超級市場", 120.0, "exp", null);
        check("退款通知", "HK$88.00 已退款至你的信用卡", 88.0, "inc", null);
    }
}
