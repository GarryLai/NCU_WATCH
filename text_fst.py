import os
import requests
from io import BytesIO
from dotenv import load_dotenv
from google import genai
from PIL import Image
from pdf2image import convert_from_bytes


def get_image_from_url(url):
    """
    從網址載入圖片，若為 PDF 則轉為圖片
    """
    try:
        print(f"正在下載資源: {url.split('/')[-1]}...")
        response = requests.get(url)
        response.raise_for_status()

        if url.lower().endswith('.pdf'):
            # 將 PDF 轉為圖片 (取第一頁)
            images = convert_from_bytes(response.content)
            if images:
                return images[0] # 回傳第一頁的 PIL Image
            else:
                raise ValueError("PDF 為空")
        else:
            return Image.open(BytesIO(response.content))
    except Exception as e:
        print(f"無法載入資源 {url}: {e}")
        raise

def get_json_from_url(url):
    """
    從網址載入文字內容
    """
    try:
        print(f"正在下載文字內容: {url}...")
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"無法載入文字內容 {url}: {e}")
        raise

def generate_content_from_images(images, prompt):
    """
    使用 Gemini 模型處理多張圖片與提示詞
    
    Args:
        images (list): PIL Image 物件列表
        prompt (str): 給模型的文字提示
        
    Returns:
        str: 模型的生成回應
    """
    # 選擇支援視覺的模型
    #建立 Client
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    
    #print(f"提示詞: {prompt}")
    
    # 發送請求 (提示詞 + 圖片列表)
    # 內容可以直接包含 text 和 image
    response = client.models.generate_content(
        model='gemini-3-flash-preview', 
        contents=[prompt, *images]
    )
    
    return response.text

def main():
    # 載入 .env 檔案
    load_dotenv()

    # --- 設定區 ---
    # 從環境變數讀取 API KEY
    API_KEY = os.getenv("GOOGLE_API_KEY")
    
    if not API_KEY:
        print("請設定 API Key！")
        return

    # setup_gemini(API_KEY)  # 不再需要
    
    # 圖片網址列表 (未來 6, 12, 18, 24 小時降雨預報)
    #api_url = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-C0032-001.json"
    api_url = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-D0047-005.json"

    image_urls = [
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_06.png",
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_12.png",
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_18.png",
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_24.png",
        "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-C0035-003.pdf" #地面天氣圖
    ]
    
    images = []
    # 下載所有圖片
    data = get_json_from_url(api_url)
    #for i in data['cwaopendata']['dataset']['location']:
    #    if i['locationName'] == '桃園市':
    #        json_txt = str(i['weatherElement'])
    json_txt = str(data['cwaopendata']['Dataset']['Locations']['Location'])
    for url in image_urls:
        img = get_image_from_url(url)
        images.append(img)

    # 測試提示詞
    #user_prompt = "這些是未來6到24小時的降雨預報圖（每6小時一張）。請綜合分析這四張圖，說明降雨區域的變化趨勢，並提醒需要注意大雨的地區。"
    user_prompt = f'''
Tell me the Taoyuan City daily weather overview for the next 24 hours in the agreed format (each item ≤65 Chinese characters, no '＊'),
including: 天氣型態、降雨預報、雨勢關注區域、風力概況、風勢關注區域. Information on QPF plot must be used in 降雨預報. Use only data from reference JSON, QPF plot (0~6, 6~12, 12~18, 18~24 hr) and surface chart images.
Only containing only those five lines (no title/date lines).

Use the following JSON data for reference:
{json_txt}
'''

    # 執行
    result = generate_content_from_images(images, user_prompt)
    
    print("\n--- Gemini 回應 ---")
    print(result)

if __name__ == "__main__":
    main()
