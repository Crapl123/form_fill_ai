
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader,
  AlertCircle,
  Database,
  ArrowLeft,
  PlusCircle,
  Trash2,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultFields: Record<string, string> = {
  "Company Name": "",
  "Legal Name": "",
  "Address Line 1": "",
  "City": "",
  "State": "",
  "Zip Code": "",
  "Country": "",
  "Contact Person": "",
  "Contact Email": "",
  "Contact Phone": "",
  "GST Number": "",
  "PAN Number": "",
};

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [masterData, setMasterData] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    getMasterData(user.uid)
      .then((data) => {
        if (data) {
          setMasterData(data);
        } else {
          // If no data, start with default fields
          setMasterData(defaultFields);
        }
      })
      .catch((err) => {
        setError(err.message);
        toast({
          variant: "destructive",
          title: "Failed to load data",
          description: err.message,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [user, authLoading, router, toast]);

  const handleFieldChange = (oldKey: string, newKey: string, value: string) => {
    setMasterData(prev => {
        if (!prev) return null;
        const newData = {...prev};
        if (oldKey !== newKey) {
            delete newData[oldKey];
        }
        newData[newKey] = value;
        return newData;
    });
  };

  const handleValueChange = (key: string, value: string) => {
    setMasterData(prev => ({...prev, [key]: value }));
  };
  
  const handleAddField = () => {
    setMasterData(prev => {
      if (!prev) return { "New Field": "" };
      let i = 1;
      let newFieldName = "New Field";
      while(Object.keys(prev).includes(newFieldName)) {
        newFieldName = `New Field ${i}`;
        i++;
      }
      return { ...prev, [newFieldName]: "" };
    });
  };

  const handleRemoveField = (key: string) => {
    setMasterData(prev => {
        if (!prev) return null;
        const newData = {...prev};
        delete newData[key];
        return newData;
    });
  };
  
  const handleSaveChanges = async () => {
    if (!user || !masterData) return;
    setIsSaving(true);
    try {
      await saveMasterData(user.uid, masterData);
      toast({
        title: "Success!",
        description: "Your master data has been saved.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
        <Loader className="h-12 w-12 animate-spin text-primary" />
      </main>
    );
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
             <div>
                <CardTitle className="text-3xl font-bold">Your Master Data</CardTitle>
                <CardDescription className="text-base">
                Add, edit, or remove fields from your master data profile.
                </CardDescription>
             </div>
             <Link href="/" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to App
                </Button>
             </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            {error && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {masterData && (
              <ScrollArea className="h-[50vh] w-full rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-[40%]">Field Name</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[50px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(masterData).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>
                          <Input
                            value={key}
                            onChange={(e) => handleFieldChange(key, e.target.value, value)}
                            placeholder="Field Name"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={value}
                            onChange={(e) => handleValueChange(key, e.target.value)}
                            placeholder="Value"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveField(key)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
             <Button variant="outline" onClick={handleAddField}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Field
             </Button>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSaveChanges} disabled={isSaving || !masterData}>
            {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

    