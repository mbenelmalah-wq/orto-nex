import React, { useState, useRef } from "react";
import { useAnalyzeChart, AnalysisResult } from "@workspace/api-client-react";
import { UploadCloud, Image as ImageIcon, X, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalysisResultCard } from "@/components/analysis-result-card";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [asset, setAsset] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("15m");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const analyzeMutation = useAnalyzeChart();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
      setResult(null); // Clear previous result
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageBase64(event.target?.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      toast({ title: "No image", description: "Please upload a chart screenshot first.", variant: "destructive" });
      return;
    }

    try {
      const data = await analyzeMutation.mutateAsync({
        data: {
          imageBase64,
          asset: asset || undefined,
          timeframe: timeframe || undefined,
        }
      });
      setResult(data);
      toast({ title: "Analysis Complete", description: "Belkhayate method applied successfully." });
    } catch (error: any) {
      toast({ 
        title: "Analysis Failed", 
        description: error?.response?.data?.error || "An error occurred during analysis.",
        variant: "destructive"
      });
    }
  };

  const clearImage = () => {
    setImageBase64(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Terminal</h1>
        <p className="text-muted-foreground">Upload a TradingView screenshot to run Belkhayate AI analysis.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload & Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-5">
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset" className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Asset</Label>
                  <Input 
                    id="asset" 
                    value={asset} 
                    onChange={(e) => setAsset(e.target.value)} 
                    placeholder="e.g. NQ1!" 
                    className="font-mono bg-secondary/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeframe" className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Timeframe</Label>
                  <Input 
                    id="timeframe" 
                    value={timeframe} 
                    onChange={(e) => setTimeframe(e.target.value)} 
                    placeholder="e.g. 15m" 
                    className="font-mono bg-secondary/50 border-border"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Chart Image</Label>
              
              {!imageBase64 ? (
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-4 text-center cursor-pointer hover:bg-secondary/20 transition-colors bg-secondary/10"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <UploadCloud className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Click or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-border group bg-black/50">
                  <img src={imageBase64} alt="Chart preview" className="w-full object-contain max-h-[300px] opacity-80" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <Button variant="destructive" size="sm" onClick={clearImage} className="gap-2">
                      <X className="w-4 h-4" /> Remove Image
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button 
              className="w-full font-bold tracking-wide" 
              size="lg" 
              disabled={!imageBase64 || analyzeMutation.isPending}
              onClick={handleAnalyze}
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ANALYZING SYSTEM...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  EXECUTE ANALYSIS
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-2">
          {result ? (
            <AnalysisResultCard result={result} />
          ) : analyzeMutation.isPending ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/30">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="font-mono text-sm tracking-widest animate-pulse">PROCESSING NEURAL NETWORK...</p>
              <p className="text-xs mt-2 opacity-50">Evaluating Belkhayate parameters</p>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/30">
              <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Awaiting chart input</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
