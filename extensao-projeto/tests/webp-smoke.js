(async () => {
  const output = document.getElementById('result');

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error(`Falha ao gerar fixture ${type}.`)),
        type,
        quality,
      );
    });
  }

  try {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 96;
    sourceCanvas.height = 64;
    const context = sourceCanvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 96, 64);
    gradient.addColorStop(0, '#ff3d00');
    gradient.addColorStop(0.5, '#00c853');
    gradient.addColorStop(1, '#2962ff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 64);
    context.fillStyle = '#ffffff';
    context.font = 'bold 20px sans-serif';
    context.fillText('KICKS', 12, 39);

    const fixtures = [
      { type: 'image/png', blob: await canvasBlob(sourceCanvas, 'image/png') },
      { type: 'image/jpeg', blob: await canvasBlob(sourceCanvas, 'image/jpeg', 0.92) },
    ];
    const results = [];

    for (let index = 0; index < fixtures.length; index++) {
      const fixture = fixtures[index];
      assert(fixture.blob.type === fixture.type, `Fixture ${fixture.type} tem MIME incorreto.`);

      const prepared = await KicksImageProcessor.prepareImageAsWebp(fixture.blob, { maxDimension: 64 });
      const exported = KicksImageProcessor.createExportImage(prepared, index + 1, `https://example.test/source-${index + 1}`);

      assert(prepared.mimeType === 'image/webp', 'MIME final não é image/webp.');
      assert(await KicksImageProcessor.hasWebpSignature(prepared.blob), 'Bytes finais não têm assinatura RIFF/WEBP.');
      assert(exported.dataUrl.startsWith('data:image/webp;base64,'), 'Data URL final não declara WebP Base64.');
      assert(exported.name === `foto-${index + 1}.webp`, 'Nome final não usa extensão .webp.');
      assert(exported.mimeType === 'image/webp', 'Metadado mimeType divergente.');
      assert(exported.size === prepared.blob.size && exported.size <= KicksImageProcessor.MAX_OUTPUT_BYTES, 'Tamanho final inválido.');
      assert(exported.width <= 64 && exported.height <= 64, 'Redimensionamento máximo não foi respeitado.');

      results.push({
        input: fixture.type,
        output: exported.mimeType,
        name: exported.name,
        size: exported.size,
        width: exported.width,
        height: exported.height,
        riffWebp: true,
        dataUrlWebp: true,
      });
    }

    // A deliberately tiny limit forces the same iterative quality/dimension
    // reduction used when a real catalog photo initially exceeds 2 MiB.
    const constrained = await KicksImageProcessor.prepareImageAsWebp(fixtures[0].blob, {
      maxDimension: 64,
      maxOutputBytes: 600,
    });
    assert(constrained.size <= 600, 'A redução iterativa não respeitou o limite configurado.');
    assert(await KicksImageProcessor.hasWebpSignature(constrained.blob), 'A redução iterativa perdeu a assinatura WebP.');
    results.push({
      input: 'image/png (limite forçado)',
      output: constrained.mimeType,
      size: constrained.size,
      width: constrained.width,
      height: constrained.height,
      iterativeReduction: true,
    });

    document.title = 'PASS - Kicks WebP smoke test';
    output.textContent = JSON.stringify({ status: 'PASS', results }, null, 2);
    output.dataset.status = 'PASS';
  } catch (error) {
    document.title = 'FAIL - Kicks WebP smoke test';
    output.textContent = JSON.stringify({ status: 'FAIL', error: error.message }, null, 2);
    output.dataset.status = 'FAIL';
  }
})();
