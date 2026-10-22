# Orioninsist Slidev (Fedora + Docker)

Kaynak repo: https://github.com/orioninsist/slidev

Üç klasör: `content/` (Markdown), `template/` (JSON tema seçimleri), `output/` (PDF/PPTX).

## Başlatma

Fedora'da Docker Engine ve çalışan Docker daemon gerekir. Bu klasörde:

```bash
bash run.sh
```

Menüde önce Markdown, sonra şablon, sonra PDF/PPTX seç. Enter varsayılan ilk seçeneği kullanır. Oluşturulan dosya `output/` içine kaydedilir.

Şablonlar resmi Slidev `default` ve `seriph` temalarını kullanır. İçerik Markdown dosyasında slaytlar `---` ile ayrılır. Orijinal `content/` dosyası değiştirilmez.

Docker ilk çalıştırmada Chromium ve bağımlılıkları indirir. Fedora SELinux altında bağlanan dizinler için `:Z` seçeneği kullanılır.

Slidev belgeleri: https://sli.dev/guide/exporting
