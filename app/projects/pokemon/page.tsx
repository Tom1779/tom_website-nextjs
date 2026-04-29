"use client";

import Image from "next/image";
import Link from "next/link";

const techStack = [
  { label: "TensorFlow / Keras", description: "CNN model implementation" },
  { label: "Scikit-learn", description: "Train/test split & metrics" },
  { label: "OpenCV & NumPy", description: "Image preprocessing" },
  { label: "Matplotlib", description: "Results visualization" },
  { label: "Google Colab", description: "Development environment" },
  { label: "Kaggle", description: "Image dataset hosting" },
];

const modelLayers = [
  { layer: "Conv2D ×2", role: "Detect subtle visual features with increasing depth" },
  { layer: "MaxPooling2D ×2", role: "Extract the most prominent features from pixel arrays" },
  { layer: "Dense ×2", role: "Classify images using convolutional output" },
  { layer: "Dropout", role: "Prevent overfitting during training" },
];

export default function PokemonClassifierPage() {
  return (
    <main className="relative z-0 text-white min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 md:px-6 pt-12 md:pt-20 pb-10 md:pb-16 max-w-4xl mx-auto">
        <span className="text-amber-300 text-xs md:text-sm font-medium tracking-widest uppercase mb-3 md:mb-4">
          Machine Learning · CNN Image Classification
        </span>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4 md:mb-6">
          Pokémon Image Classifier
        </h1>
        <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-2xl">
          A convolutional neural network trained to identify four Pokémon species
          from images achieving 88–96% accuracy using TensorFlow, Keras, and a
          custom preprocessed dataset.
        </p>

        <div className="flex gap-3 md:gap-4 mt-6 md:mt-8 flex-wrap justify-center">
          <a
            href="https://colab.research.google.com/drive/1chjiQtYAlOEotvwR6vHCd9jbkJQZnTVR?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 md:px-5 py-2 md:py-2.5 bg-amber-300 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg text-sm transition-colors duration-200"
          >
            Open in Colab →
          </a>
          <Link
            href="/"
            className="px-4 md:px-5 py-2 md:py-2.5 border border-gray-600 hover:border-amber-300 text-gray-300 hover:text-amber-300 rounded-lg text-sm transition-colors duration-200"
          >
            ← Back to Projects
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Introduction */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4">
          Introduction
        </h2>
        <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
          For our final Machine Learning course assignment, the team and
          I set out to combine the world of Pokemon with the power of Convolutional
          Neural Networks. The goal: build an image recognition system capable of
          distinguishing between four unique Pokemon species with high accuracy.
        </p>
        <p className="text-gray-300 text-sm md:text-base leading-relaxed">
          CNNs are well-suited for image classification tasks due to their ability
          to learn spatial hierarchies of features, making them a natural fit for
          differentiating visually distinct (and sometimes surprisingly similar)
          Pokémon.
        </p>
      </section>

      {/* Pokemon image */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 pb-10 md:pb-16">
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <Image
            src="/pokemon1.jpg"
            alt="The four Pokémon used in the classifier"
            width={1200}
            height={600}
            className="w-full h-auto object-cover"
          />
        </div>
        <p className="text-gray-500 text-xs text-center mt-3">
          The four Pokémon species selected for classification
        </p>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Tech Stack */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4 md:mb-6">
          Tools & Technologies
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {techStack.map((tech) => (
            <div
              key={tech.label}
              className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 hover:border-amber-300/40 transition-colors duration-200"
            >
              <p className="text-white font-semibold text-xs md:text-sm mb-1">{tech.label}</p>
              <p className="text-gray-400 text-xs">{tech.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Setup & Methodology */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4">
          Setup & Methodology
        </h2>
        <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
          For each Pokémon we collected between 270 and 370 images sourced online,
          uploaded to Kaggle, and imported into Google Colab. The dataset was split
          80/20 into training and testing samples, with pixel values normalized by
          dividing by 255.
        </p>
        <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-8 md:mb-10">
          The model architecture was the most time-intensive part, requiring
          multiple iterations to find the right number of layers for optimal
          accuracy without overfitting. We settled on a 7-layer CNN, trained for
          up to 15 epochs with early stopping when accuracy began to decline.
        </p>

        <h3 className="text-white text-sm md:text-base font-semibold mb-3 md:mb-4">Model Architecture (7 Layers)</h3>
        <div className="flex flex-col gap-2">
          {modelLayers.map((item, i) => (
            <div
              key={item.layer}
              className="flex items-start gap-3 md:gap-4 bg-white/5 border border-white/10 rounded-xl px-3 md:px-4 py-3"
            >
              <span className="text-amber-300 font-mono text-xs mt-0.5 min-w-[2rem]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-white text-xs md:text-sm font-semibold">{item.layer}</p>
                <p className="text-gray-400 text-xs">{item.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Results */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4 md:mb-6">
          Results
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-8 md:mb-12">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 text-center">
            <p className="text-amber-300 text-3xl md:text-4xl font-bold mb-1">~96%</p>
            <p className="text-gray-400 text-xs md:text-sm">Peak test accuracy</p>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 text-center">
            <p className="text-amber-300 text-3xl md:text-4xl font-bold mb-1">88–96%</p>
            <p className="text-gray-400 text-xs md:text-sm">Accuracy across runs</p>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 text-center">
            <p className="text-amber-300 text-3xl md:text-4xl font-bold mb-1">4</p>
            <p className="text-gray-400 text-xs md:text-sm">Pokémon species classified</p>
          </div>
        </div>

        <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-8 md:mb-10">
          The most common misclassification was Charmander being identified as
          Pikachu, likely due to shared visual traits like a tail and similar
          warm skin tones. The confusion matrix and epoch graph below illustrate
          the model&apos;s performance in detail.
        </p>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-1/2 rounded-2xl overflow-hidden border border-white/10">
            <Image
              src="/pokemon2.jpg"
              alt="Confusion matrix showing classification results"
              width={700}
              height={500}
              className="w-full h-auto object-cover"
            />
            <p className="text-gray-500 text-xs text-center py-2">Confusion matrix</p>
          </div>
          <div className="w-full md:w-1/2 rounded-2xl overflow-hidden border border-white/10">
            <Image
              src="/pokemon3.jpg"
              alt="Model accuracy across training epochs"
              width={700}
              height={500}
              className="w-full h-auto object-cover"
            />
            <p className="text-gray-500 text-xs text-center py-2">Accuracy across epochs</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Conclusion */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16 pb-16 md:pb-20">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4">
          Conclusion
        </h2>
        <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
          This project demonstrates that a CNN can reliably classify Pokémon images
          with high accuracy as long as the species don&apos;t share too many visual
          similarities. The 88–96% accuracy range held consistent across multiple
          runs with different dataset samples.
        </p>
        <p className="text-gray-300 text-sm md:text-base leading-relaxed">
          Future improvements would include expanding to more Pokémon species,
          increasing image count and quality per class, and experimenting with
          transfer learning using pretrained models like ResNet or MobileNet for
          even higher accuracy.
        </p>
      </section>

      {/* Footer nav */}
      <div className="flex justify-center pb-12 md:pb-16">
        <Link
          href="/"
          className="px-4 md:px-5 py-2 md:py-2.5 border border-gray-600 hover:border-amber-300 text-gray-300 hover:text-amber-300 rounded-lg text-sm transition-colors duration-200"
        >
          ← Back to Projects
        </Link>
      </div>
    </main>
  );
}