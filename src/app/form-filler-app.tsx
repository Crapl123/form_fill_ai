
"use client";

import React, { useEffect, useState, useActionState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ExcelJS from "exceljs";
import { useAuth } from "@/context/AuthContext";
import { getMasterData, saveMasterData } from "@/lib/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CloudUpload,
  FileCheck,
  Loader,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  Database,
  ListChecks,
  ArrowRight,
  Wand2,
  FileEdit,
  RefreshCw,
  HelpCircle,
  BookUp,
  LogOut,
  User as UserIcon,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { processForm, applyCorrections, FormState } from "./actions";
import { useToast } from "@/hooks/use-toast";

const initialProcessState: FormState = {
  status: "idle",
  message: "",
  fileData: null,
  fileName: "",
  mimeType: "",
  debugInfo: undefined,
  previewData: [],
  missingFields: [],
};

const FileUploadDropzone = ({ file, onFileChange, icon, title, description, inputId, accept, ...props }) => {
  return (
    <label htmlFor={inputId} className="cursor-pointer">
      <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-border p-10 text-center transition hover:border-primary bg-secondary/50 hover:bg-secondary">
        {file ? (
          <>
            <FileCheck className="h-10 w-10 text-green-500" />
            <p className="font-semibold text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">Click or drag to change file</p>
          </>
        ) : (
          <>
            {icon}
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </div>
      <Input
        id={inputId}
        name={inputId}
        type="file"
        className="sr-only"
        onChange={onFileChange}
        accept={accept}
        {...props}
      />
    </label>
  )
}

function CorrectionForm({ processState, masterData, onMasterDataUpdate, onBack }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [correctionState, correctionAction, isSubmittingCorrections] = useActionState(applyCorrections, initialProcessState);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [updatedMasterDataUrl, setUpdatedMasterDataUrl] = useState<string | null>(null);

  const uniqueMissingFields = useMemo(() => {
    if (!processState.missingFields) return [];
    const seen = new Set();
    return processState.missingFields.filter(item => {
      const duplicate = seen.has(item.targetCell);
      seen.add(item.targetCell);
      return !duplicate;
    });
  }, [processState.missingFields]);

  useEffect(() => {
    if (correctionState.status === "error") {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: correctionState.message,
      });
    }

    if (correctionState.status === "success" && correctionState.fileData && correctionState.mimeType) {
      toast({
        variant: "default",
        title: "Success!",
        description: "Your files are ready for download.",
      });
      
      const createUrl = (fileData: string, mimeType: string) => {
        const byteCharacters = atob(fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
      }

      setDownloadUrl(createUrl(correctionState.fileData, correctionState.mimeType));
      
      if (correctionState.updatedMasterData) {
        setUpdatedMasterDataUrl(createUrl(correctionState.updatedMasterData, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
      }

      if (correctionState.updatedMasterDataJSON && user) {
        onMasterDataUpdate(correctionState.updatedMasterDataJSON);
        saveMasterData(user.uid, correctionState.updatedMasterDataJSON);
        toast({
          variant: "default",
          title: "Master Data Updated",
          description: "Your data has been saved for future use.",
        });
      }
    }
  }, [correctionState, toast, onMasterDataUpdate, user]);

  return (
    <form action={correctionAction} className="space-y-6">
      <input type="hidden" name="fileData" value={processState.fileData ?? ""} />
      <input type="hidden" name="fileName" value={processState.fileName ?? ""} />
      <input type="hidden" name="mimeType" value={processState.mimeType ?? ""} />
      <input type="hidden" name="masterData" value={JSON.stringify(masterData ?? {})} />
      <input type="hidden" name="missingFields" value={JSON.stringify(uniqueMissingFields ?? [])} />

      
      {uniqueMissingFields && uniqueMissingFields.length > 0 && (
          <div className="space-y-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-center gap-2">
                 <HelpCircle className="h-5 w-5 text-yellow-600" />
                 <h3 className="font-semibold text-yellow-300">Missing Information</h3>
              </div>
              <p className="text-sm text-yellow-400">The AI identified these fields in the form but couldn't find matching data. Please provide the values below to improve future results.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {uniqueMissingFields.map(item => (
                    <div className="space-y-2" key={item.targetCell}>
                        <Label htmlFor={`missing_${item.targetCell}`} className="text-foreground">{item.labelGuessed}</Label>
                        <Input 
                            id={`missing_${item.targetCell}`}
                            name={`missing_${item.targetCell}`}
                            placeholder={`Enter value for ${item.labelGuessed}...`}
                            className="bg-background border-border"
                        />
                    </div>
                ))}
              </div>
          </div>
      )}

      <div>
          <h3 className="mb-2 font-semibold text-foreground">Make Text-based Corrections (Optional)</h3>
          <Textarea
            name="correctionRequest"
            placeholder="e.g., Change the value in B5 to 'Completed'. Remove the value from C10."
            className="min-h-[100px] bg-background border-border"
          />
      </div>

      {isSubmittingCorrections && (
        <Progress value={50} className="w-full" />
      )}

      {correctionState.status === "error" && correctionState.message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Correction Error</AlertTitle>
          <AlertDescription>{correctionState.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {downloadUrl ? (
          <div className="flex flex-col gap-2">
            <a href={downloadUrl} download={correctionState.fileName} className="w-full">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" size="lg" variant="default" type="button">
                <Download className="mr-2 h-4 w-4" />
                Download Corrected Form
              </Button>
            </a>
            {updatedMasterDataUrl && (
                <a href={updatedMasterDataUrl} download={correctionState.updatedMasterDataFileName} className="w-full">
                    <Button className="w-full" size="lg" variant="secondary" type="button">
                    <BookUp className="mr-2 h-4 w-4" />
                    Download Updated Master Data
                    </Button>
                </a>
            )}
          </div>
        ) : (
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" size="lg" disabled={isSubmittingCorrections}>
            {isSubmittingCorrections ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Applying Changes...</> : <><Wand2 className="mr-2 h-4 w-4" /> Apply Changes & Download</>}
          </Button>
        )}
      </div>

       <Button variant="outline" onClick={onBack} className="w-full border-border hover:bg-secondary">
          <ArrowLeft className="mr-2 h-4 w-4"/>
          Back to Upload
       </Button>
    </form>
  )
}

function InitialSetup({ onSetupComplete }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [setupMode, setSetupMode] = useState<"choice" | "upload" | "manual">("choice");
  const [masterDataFile, setMasterDataFile] = useState<File | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      const isValid = selectedFile && (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".csv"));
      if (isValid) {
        setMasterDataFile(selectedFile);
        handleParse(selectedFile);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx or .csv file.",
        });
      }
    }
  };
  
  const parseCsv = (file: File): Promise<Record<string, string>> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const data: Record<string, string> = {};
            const rows = text.split(/\r?\n/);
            rows.forEach(row => {
                const columns = row.split(',');
                if (columns.length >= 2) {
                    const key = columns[0].trim();
                    const value = columns.slice(1).join(',').trim();
                    if(key) data[key] = value;
                }
            });
            if(Object.keys(data).length === 0) {
              reject(new Error("Could not parse any data. Ensure the CSV has at least two columns: key, value."));
            } else {
              resolve(data);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
  }
  
  const parseXlsx = async (file: File): Promise<Record<string, string>> => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("No worksheet found.");

    const data: Record<string, string> = {};
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const keyCell = row.getCell(1);
      const valueCell = row.getCell(2);
      const key = keyCell.text?.trim();
      if (key) {
        data[key] = valueCell.text?.trim() || "";
      }
    });

    if(Object.keys(data).length === 0) {
      throw new Error("Could not parse any data. Ensure the first column has keys and the second has values.");
    }
    return data;
  }

  const handleParse = async (file: File) => {
    if (!file || !user) return;
    try {
      let data: Record<string, string>;
      if (file.name.endsWith('.csv')) {
          data = await parseCsv(file);
      } else {
          data = await parseXlsx(file);
      }
      
      await saveMasterData(user.uid, data);
      onSetupComplete(data);
      toast({ title: "Success!", description: "Your master data has been saved from the sheet." });

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Parsing Failed", description: message });
    }
  };
  
  const handleStartManually = () => {
    router.push('/profile');
  };

  if (setupMode === 'choice') {
    return (
       <CardContent className="space-y-4 pt-6">
        <Alert className="bg-secondary/50 border-border text-muted-foreground">
          <Database className="h-4 w-4 text-primary" />
          <AlertTitle className="text-foreground">Welcome! Let's get your data setup.</AlertTitle>
          <AlertDescription>
            You can upload an Excel/CSV sheet with your master data, or enter it manually to get started.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" size="lg" className="h-auto py-6 flex flex-col gap-2 border-border hover:bg-secondary hover:border-primary/50" onClick={() => setSetupMode('upload')}>
                <CloudUpload className="h-8 w-8 text-primary"/>
                <span className="text-foreground">Upload Master Sheet</span>
                <span className="text-xs font-normal text-muted-foreground">(.xlsx or .csv)</span>
            </Button>
            <Button variant="outline" size="lg" className="h-auto py-6 flex flex-col gap-2 border-border hover:bg-secondary hover:border-primary/50" onClick={handleStartManually}>
                <Pencil className="h-8 w-8 text-primary"/>
                <span className="text-foreground">Enter Data Manually</span>
                <span className="text-xs font-normal text-muted-foreground">We'll take you to your profile to start.</span>
            </Button>
        </div>
      </CardContent>
    );
  }

  if (setupMode === 'upload') {
     return (
      <CardContent className="space-y-4 pt-6">
        <FileUploadDropzone
          file={masterDataFile}
          onFileChange={handleFileChange}
          icon={<Database className="h-10 w-10 text-muted-foreground" />}
          title="Upload Master Data Sheet"
          description="Excel (.xlsx) or CSV (.csv) files only"
          inputId="master-data-upload"
          accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
        />
        <Button onClick={() => setSetupMode('choice')} variant="link" className="text-primary">Back to options</Button>
      </CardContent>
    );
  }
  
  return null;
}


function FormFiller({ masterData, onMasterDataUpdate, isTrial = false }) {
  const { toast } = useToast();
  const [processState, processAction, isProcessing] = useActionState(processForm, initialProcessState);
  const [vendorFormFile, setVendorFormFile] = useState<File | null>(null);
  const [directDownloadUrl, setDirectDownloadUrl] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);

  useEffect(() => {
    if (processState.status === "error") {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: processState.message,
      });
    }

    if (processState.status === "preview" && processState.fileData && processState.mimeType) {
      if (isTrial) {
        setTrialUsed(true);
      }
      const byteCharacters = atob(processState.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: processState.mimeType });
      const url = URL.createObjectURL(blob);
      setDirectDownloadUrl(url); 
    }
  }, [processState, toast, isTrial]);
  
  const handleVendorFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      const isValid = selectedFile && (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".pdf"));
      if (isValid) {
        setVendorFormFile(selectedFile);
        setDirectDownloadUrl(null);
        if (processState.status !== 'idle') {
          Object.assign(processState, initialProcessState);
        }
      } else {
        setVendorFormFile(null);
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a valid .xlsx or .pdf file.",
        });
      }
    }
  };

  const resetFormFill = () => {
      setVendorFormFile(null);
      setDirectDownloadUrl(null);
      Object.assign(processState, initialProcessState);
  }

  if (isTrial && trialUsed) {
    return (
        <CardContent className="text-center pt-6">
            <Alert className="bg-primary/10 border-primary/20 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle className="text-foreground">Trial Successful!</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                    <p>Your form has been processed. To save your master data and continue filling unlimited forms, please sign up.</p>
                    <div className="mt-4 flex justify-center gap-2">
                         <Link href="/login" passHref>
                            <Button>Sign Up / Login</Button>
                         </Link>
                         {directDownloadUrl && (
                             <a href={directDownloadUrl} download={processState.fileName} className="w-full">
                                <Button variant="secondary">Download Filled Form</Button>
                             </a>
                         )}
                    </div>
                </AlertDescription>
            </Alert>
        </CardContent>
    );
  }

  if (processState.status !== 'preview') {
    return (
      <form action={processAction}>
        <CardContent className="space-y-6 pt-6">
          <input type="hidden" name="masterData" value={JSON.stringify(masterData ?? {})} />
          <FileUploadDropzone
              file={vendorFormFile}
              onFileChange={handleVendorFormFileChange}
              icon={<CloudUpload className="h-10 w-10 text-muted-foreground" />}
              title="Upload Form To Fill"
              description="Excel or PDF files only (.xlsx, .pdf)"
              inputId="file"
              name="file"
              required
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .pdf, application/pdf"
          />
          
          {isProcessing && (
            <div className="space-y-2">
               <div className="flex items-center gap-3 text-primary">
                  <Loader className="h-5 w-5 animate-spin" />
                  <span className="font-medium">AI is analyzing and filling your form...</span>
               </div>
               <Progress value={50} className="w-full" />
            </div>
          )}
          
          {processState.status === "error" && processState.message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{processState.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isProcessing || !vendorFormFile} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" size="lg">
              {isProcessing ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Zap className="mr-2 h-4 w-4" /> Auto-Fill Form</>}
          </Button>
        </CardFooter>
      </form>
    );
  }

  return (
    <CardContent className="space-y-4 pt-6">
      <Alert className="bg-secondary/50 border-border text-muted-foreground">
        <FileEdit className="h-4 w-4 text-primary" />
        <AlertTitle className="text-foreground">Preview, Fill & Correct</AlertTitle>
        <AlertDescription>
          The AI has filled what it can. Please provide any missing information and make corrections below.
        </AlertDescription>
      </Alert>

      {processState.mimeType === 'application/pdf' && processState.fileData ? (
        <div className="rounded-md border border-border">
          <iframe
            src={`data:application/pdf;base64,${processState.fileData}`}
            className="h-[600px] w-full"
            title="PDF Preview"
          />
        </div>
      ) : (
        <div>
            <h3 className="mb-2 font-semibold text-foreground">AI Auto-Filled Data</h3>
            <ScrollArea className="h-60 w-full rounded-md border border-border">
            <Table>
                <TableHeader>
                <TableRow className="border-border hover:bg-secondary/50">
                    <TableHead className="text-muted-foreground">Guessed Label</TableHead>
                    <TableHead className="text-muted-foreground">Cell Filled</TableHead>
                    <TableHead className="text-muted-foreground">Value Filled</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {processState.previewData?.length > 0 ? processState.previewData?.map((item) => (
                    <TableRow key={item.cell} className="border-border hover:bg-secondary/50">
                    <TableCell className="text-muted-foreground">{item.labelGuessed || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-accent">{item.cell}</TableCell>
                    <TableCell className="font-medium text-foreground">{item.value}</TableCell>
                    </TableRow>
                )) : (
                    <TableRow className="border-border hover:bg-secondary/50">
                        <TableCell colSpan={3} className="text-center text-muted-foreground">The AI could not fill any fields automatically.</TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </ScrollArea>
        </div>
      )}
      
      <CorrectionForm 
        processState={processState} 
        masterData={masterData}
        onMasterDataUpdate={onMasterDataUpdate}
        onBack={resetFormFill}
      />
      
      <CardFooter className="flex-col gap-4 px-0 pb-0 pt-4">
        {directDownloadUrl && (
           <a href={directDownloadUrl} download={processState.fileName} className="w-full">
             <Button className="w-full" size="lg" variant="outline">
               <Download className="mr-2 h-4 w-4" />
               Download Initial Filled Form
             </Button>
           </a>
        )}
      </CardFooter>
    </CardContent>
  );
}


export default function FormFillerApp() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [masterData, setMasterData] = useState<Record<string, string> | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        setLoadingData(true);
        getMasterData(user.uid)
          .then((data) => {
            setMasterData(data);
          })
          .catch((error) => {
            toast({
              variant: "destructive",
              title: "Could not load user data.",
              description: error.message,
            });
          })
          .finally(() => {
            setLoadingData(false);
          });
      } else {
        setLoadingData(false);
        setMasterData(null);
      }
    }
  }, [user, authLoading, toast]);

  const handleSignOut = async () => {
    await signOut();
    setMasterData(null);
    router.push('/');
  };

  const renderContent = () => {
    // Show a loader while checking authentication or fetching data
    if (authLoading || (user && loadingData)) {
      return (
        <CardContent className="flex justify-center items-center h-64">
          <Loader className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      );
    }
    
    // Logged-in user, but hasn't set up master data yet
    if (user && !masterData) {
      return <InitialSetup onSetupComplete={setMasterData} />;
    }

    // Logged-in user with master data
    if (user && masterData) {
      return <FormFiller masterData={masterData} onMasterDataUpdate={setMasterData} isTrial={false} />;
    }
    
    // User is not logged in (guest), show the trial version.
    // We pass empty master data and isTrial=true.
    if (!user) {
        return <FormFiller masterData={{}} onMasterDataUpdate={() => {}} isTrial={true} />;
    }

    return null;
  }

  return (
      <Card className="w-full max-w-4xl mx-auto shadow-2xl bg-card border-border text-foreground">
        <CardHeader className="text-center relative">
          <div className="mx-auto bg-primary/10 text-primary rounded-full p-3 w-fit mb-4 border border-primary/20">
            <Wand2 className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Try Form AutoFill AI</CardTitle>
          <CardDescription className="text-base max-w-2xl mx-auto text-muted-foreground">
            Upload your form below to see the AI in action.
          </CardDescription>
          {user && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <Link href="/profile">
                <Button variant="ghost" size="icon" title="Profile" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
                    <UserIcon className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </CardHeader>
        
        {renderContent()}
      </Card>
  );
}

    